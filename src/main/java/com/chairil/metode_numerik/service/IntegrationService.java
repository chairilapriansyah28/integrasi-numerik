package com.chairil.metode_numerik.service;

import com.chairil.metode_numerik.model.request.IntegrationRequest;
import com.chairil.metode_numerik.model.response.IntegrationResponse;
import com.chairil.metode_numerik.model.response.IntegrationResponse.StepDetail;
import com.chairil.metode_numerik.util.FunctionParser;
import com.chairil.metode_numerik.util.SymbolicIntegrator;
import com.chairil.metode_numerik.util.SymbolicIntegrator.ExactResult;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleUnaryOperator;

/**
 * Service inti yang mengimplementasikan:
 *  1. Kaidah Segiempat (Rectangle Rule) — kiri / kanan
 *  2. Kaidah Titik Tengah (Midpoint Rule)
 *  3. Kaidah Trapesium (Trapezoidal Rule)
 *  4. Nilai Eksak (anti-derivatif analitik) + true error      ← BARU
 *  5. Pencarian n optimal berdasarkan target toleransi        ← BARU
 */
@Service
public class IntegrationService {

    private final FunctionParser functionParser;
    private final SymbolicIntegrator symbolicIntegrator;

    /** Batas pencarian n optimal agar tidak infinite loop pada fungsi yang sulit konvergen. */
    private static final int MAX_N_SEARCH = 100_000;

    public IntegrationService(FunctionParser functionParser, SymbolicIntegrator symbolicIntegrator) {
        this.functionParser = functionParser;
        this.symbolicIntegrator = symbolicIntegrator;
    }

    /**
     * Entry point — memilih metode sesuai request.
     */
    public IntegrationResponse calculate(IntegrationRequest req) {
        validateBounds(req);

        DoubleUnaryOperator f = functionParser.parse(req.getFunction());
        String method = req.getMethod().toLowerCase();

        IntegrationResponse res = switch (method) {
            case "midpoint"   -> midpointRule(f, req);
            case "rectangle"  -> rectangleRule(f, req);
            case "trapezoid"  -> trapezoidRule(f, req);
            default -> throw new IllegalArgumentException("Metode tidak dikenali: " + method);
        };

        // ===== NILAI EKSAK =====
        attachExactValue(res, req);

        // ===== PENCARIAN N OPTIMAL =====
        if (req.getTargetTolerance() != null && req.getTargetTolerance() > 0) {
            attachSuggestedN(res, f, req);
        }

        return res;
    }

    // =========================================================
    //  KAIDAH SEGIEMPAT (RECTANGLE RULE)
    // ========================================================
    /**
     * Formula:
     *   I ≈ h · Σ f(xᵢ)   untuk i = 0..n-1 (kiri)
     *   I ≈ h · Σ f(xᵢ)   untuk i = 1..n   (kanan)
     */
    private IntegrationResponse rectangleRule(DoubleUnaryOperator f, IntegrationRequest req) {
        double a = req.getLowerBound();
        double b = req.getUpperBound();
        int    n = req.getN();
        String variant = req.getVariant() == null ? "left" : req.getVariant().toLowerCase();

        double h   = (b - a) / n;
        double sum = 0.0;
        List<StepDetail> steps = new ArrayList<>();

        for (int i = 0; i < n; i++) {
            double xi  = (variant.equals("right")) ? a + (i + 1) * h : a + i * h;
            double fxi = f.applyAsDouble(xi);
            sum += fxi;
            if (i < 10) steps.add(new StepDetail(i + 1, xi, fxi));
        }
        double result = h * sum;
        double error  = estimateError(f, a, b, n, "rectangle", variant);
        return buildResponse(result, h, n, "rectangle", variant, error, steps);
    }

    // =========================================================
    //  KAIDAH TITIK TENGAH (MIDPOINT RULE)
    // =========================================================
    /**
     * Formula:
     *   I ≈ h · Σ f(xᵢ₊½)
     *   xᵢ₊½ = a + (i + 0.5) · h
     */
    private IntegrationResponse midpointRule(DoubleUnaryOperator f, IntegrationRequest req) {
        double a = req.getLowerBound();
        double b = req.getUpperBound();
        int    n = req.getN();

        double h   = (b - a) / n;
        double sum = 0.0;
        List<StepDetail> steps = new ArrayList<>();

        for (int i = 0; i < n; i++) {
            double xi  = a + (i + 0.5) * h;
            double fxi = f.applyAsDouble(xi);
            sum += fxi;
            if (i < 10) steps.add(new StepDetail(i + 1, xi, fxi));
        }
        double result = h * sum;
        double error  = estimateError(f, a, b, n, "midpoint", null);

        return buildResponse(result, h, n, "midpoint", "midpoint", error, steps);
    }

    // =========================================================
    //  KAIDAH TRAPESIUM (TRAPEZOIDAL RULE)
    // =========================================================
    /**
     * Kaidah Trapesium Komposit.
     *
     * Formula:
     *   I ≈ (h/2) · [f(x₀) + 2·Σf(xᵢ) + f(xₙ)]
     *   h = (b - a) / n
     *
     * Prinsip: luas trapesium = ½ · (f(xᵢ) + f(xᵢ₊₁)) · h
     * Error order O(h²) global (lebih baik dari segiempat biasa).
     */
    //  KAIDAH TRAPESIUM (TRAPEZOIDAL RULE)
    private IntegrationResponse trapezoidRule(DoubleUnaryOperator f, IntegrationRequest req) {
        double a = req.getLowerBound();
        double b = req.getUpperBound();
        int    n = req.getN();

        double h   = (b - a) / n;
        double sum = f.applyAsDouble(a) + f.applyAsDouble(b); // ujung kiri + ujung kanan (koef 1)
        List<StepDetail> steps = new ArrayList<>();

        // Titik ujung awal (i=0 → x=a)
        steps.add(new StepDetail(0, a, f.applyAsDouble(a)));

        // Titik-titik interior (koefisien 2)
        for (int i = 1; i < n; i++) {
            double xi  = a + i * h;
            double fxi = f.applyAsDouble(xi);
            sum += 2.0 * fxi;
            if (i < 10) steps.add(new StepDetail(i, xi, fxi));
        }
        // Titik ujung akhir (i=n → x=b)
        if (n < 10) steps.add(new StepDetail(n, b, f.applyAsDouble(b)));
        double result = (h / 2.0) * sum;
        double error  = estimateError(f, a, b, n, "trapezoid", null);
        return buildResponse(result, h, n, "trapezoid", "trapezoid", error, steps);
    }

    // =========================================================
    //  NILAI EKSAK — anti-derivatif analitik + true error      ← BARU
    // =========================================================

    /**
     * Mencoba menghitung nilai eksak integral menggunakan SymbolicIntegrator.
     * Jika fungsi tidak dikenali (misal kombinasi rumit), field exactAvailable
     * akan diset false dan frontend menyembunyikan perbandingan ini.
     */
    private void attachExactValue(IntegrationResponse res, IntegrationRequest req) {
        ExactResult exact = symbolicIntegrator.integrate(
                req.getFunction(), req.getLowerBound(), req.getUpperBound());

        res.setExactAvailable(exact.available());
        if (exact.available()) {
            res.setExactValue(exact.value());
            res.setAntiderivative(exact.antiderivative());

            double trueErr = Math.abs(res.getResult() - exact.value());
            res.setTrueError(trueErr);

            double percent = (exact.value() != 0)
                    ? (trueErr / Math.abs(exact.value())) * 100.0
                    : (trueErr == 0 ? 0.0 : Double.POSITIVE_INFINITY);
            res.setTrueErrorPercent(percent);
        }
    }

    // =========================================================
    //  PENCARIAN N OPTIMAL                                      ← BARU
    // =========================================================

    /**
     * Mencari n minimum (kelipatan dari n awal, doubling search lalu
     * binary-search sederhana) agar errorEstimate (Richardson) berada
     * di bawah targetTolerance.
     *
     * Strategi:
     *   1. Mulai dari n=1, gandakan terus (1,2,4,8,...) sampai error <= toleransi
     *      atau n melewati batas MAX_N_SEARCH.
     *   2. Setelah ditemukan batas atas, lakukan pencarian biner di antara
     *      n/2 (gagal) dan n (berhasil) untuk mendapatkan n yang lebih presisi.
     */
    private void attachSuggestedN(IntegrationResponse res, DoubleUnaryOperator f, IntegrationRequest req) {
        double a = req.getLowerBound();
        double b = req.getUpperBound();
        String method = req.getMethod().toLowerCase();
        String variant = req.getVariant();
        double tol = req.getTargetTolerance();

        res.setTargetTolerance(tol);

        int lo = 1;
        int hi = 1;
        double errAtHi = estimateError(f, a, b, hi, method, variant);

        // Doubling search untuk menemukan batas atas yang memenuhi toleransi
        while (errAtHi > tol && hi < MAX_N_SEARCH) {
            lo = hi;
            hi = Math.min(hi * 2, MAX_N_SEARCH);
            errAtHi = estimateError(f, a, b, hi, method, variant);
            if (hi == MAX_N_SEARCH) break;
        }

        if (errAtHi > tol) {
            // Tidak konvergen dalam batas pencarian — laporkan batas maksimum
            res.setSuggestedN(MAX_N_SEARCH);
            return;
        }

        // Binary search halus di antara lo (mungkin gagal) dan hi (berhasil)
        int left = lo, right = hi;
        while (right - left > 1) {
            int mid = (left + right) / 2;
            double errMid = estimateError(f, a, b, mid, method, variant);
            if (errMid <= tol) right = mid;
            else left = mid;
        }

        res.setSuggestedN(right);
    }

    // =========================================================
    //  HELPER: ESTIMASI ERROR (Richardson)
    // =========================================================

    /**
     * |E| ≈ |I(2n) - I(n)| / (2^p - 1)
     *  p = 2 untuk midpoint & trapezoid, p = 1 untuk rectangle
     */
    private double estimateError(DoubleUnaryOperator f, double a, double b,
                                  int n, String method, String variant) {
        double result_n  = rawCompute(f, a, b, n,     method, variant);
        double result_2n = rawCompute(f, a, b, n * 2, method, variant);
        int p = method.equals("rectangle") ? 1 : 2;
        return Math.abs(result_2n - result_n) / (Math.pow(2, p) - 1);
    }

    private double rawCompute(DoubleUnaryOperator f, double a, double b,
                               int n, String method, String variant) {
        double h   = (b - a) / n;
        double sum = 0.0;
        if ("trapezoid".equals(method)) {
            sum = f.applyAsDouble(a) + f.applyAsDouble(b);
            for (int i = 1; i < n; i++) sum += 2.0 * f.applyAsDouble(a + i * h);
            return (h / 2.0) * sum;
        }
        for (int i = 0; i < n; i++) {
            double xi;
            if ("midpoint".equals(method))        xi = a + (i + 0.5) * h;
            else if ("right".equals(variant))      xi = a + (i + 1) * h;
            else                                   xi = a + i * h;
            sum += f.applyAsDouble(xi);
        }
        return h * sum;
    }

    // =========================================================
    //  BUILDER & VALIDASI
    // =========================================================

    private IntegrationResponse buildResponse(double result, double h, int n,
                                               String method, String variant,
                                               double error, List<StepDetail> steps) {
        IntegrationResponse res = new IntegrationResponse();
        res.setResult(result);
        res.setH(h);
        res.setN(n);
        res.setMethod(method);
        res.setVariant(variant);
        res.setErrorEstimate(error);
        res.setSteps(steps);
        return res;
    }

    private void validateBounds(IntegrationRequest req) {
        if (req.getLowerBound() >= req.getUpperBound()) {
            throw new IllegalArgumentException(
                "Batas bawah (a=" + req.getLowerBound() +
                ") harus lebih kecil dari batas atas (b=" + req.getUpperBound() + ")"
            );
        }
    }
}
