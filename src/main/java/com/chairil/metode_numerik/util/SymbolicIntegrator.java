package com.chairil.metode_numerik.util;

import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Penghitung nilai eksak (anti-derivatif analitik) untuk fungsi-fungsi umum
 * yang sering dipakai di kalkulus dasar.
 *
 * Mendukung pengenalan pola berikut (boleh dikombinasi dengan koefisien & pangkat):
 *   - Polinomial:      x^n, c*x^n, c*x, c
 *   - Trigonometri:    sin(x), cos(x), tan(x)
 *   - Eksponensial:    e^x, exp(x)
 *   - Logaritma:       ln(x), 1/x
 *   - sqrt(x)
 *
 * Catatan: ini BUKAN computer algebra system (CAS) lengkap — hanya mengenali
 * pola ekspresi tunggal atau penjumlahan suku-suku sederhana yang dipisah +/-.
 * Jika pola tidak dikenali, hasil dianggap "tidak tersedia" dan UI akan
 * menyembunyikan perbandingan nilai eksak.
 */
@Component
public class SymbolicIntegrator {

    /** Hasil pencarian integral eksak. */
    public record ExactResult(boolean available, double value, String antiderivative) {
        public static ExactResult unavailable() {
            return new ExactResult(false, Double.NaN, null);
        }
    }

    /**
     * Coba hitung ∫ f(x) dx dari a ke b secara eksak.
     * Mengembalikan unavailable() jika ekspresi tidak dikenali.
     */
    public ExactResult integrate(String expression, double a, double b) {
        String expr = normalize(expression);

        // Pisahkan menjadi suku-suku berdasarkan + / - di level teratas
        var terms = splitTerms(expr);
        if (terms.isEmpty()) return ExactResult.unavailable();

        double value = 0.0;
        StringBuilder antiderivative = new StringBuilder();

        for (Term t : terms) {
            Antiderivative ad = antiderivativeOf(t.body);
            if (ad == null) return ExactResult.unavailable();

            double coef = t.sign * t.coefficient;
            double termValue = coef * (ad.evaluate(b) - ad.evaluate(a));
            value += termValue;

            if (antiderivative.length() > 0) antiderivative.append(t.sign > 0 ? " + " : " - ");
            else if (t.sign < 0) antiderivative.append("-");
            antiderivative.append(formatCoef(Math.abs(coef))).append(ad.label());
        }

        return new ExactResult(true, value, antiderivative.toString());
    }

    // =========================================================
    //  PARSING SUKU (TERMS)
    // =========================================================

    private record Term(int sign, double coefficient, String body) {}

    private java.util.List<Term> splitTerms(String expr) {
        java.util.List<Term> terms = new java.util.ArrayList<>();
        int sign = 1;
        int start = 0;
        int depth = 0;

        for (int i = 0; i <= expr.length(); i++) {
            boolean end = i == expr.length();
            char c = end ? ' ' : expr.charAt(i);
            if (c == '(') depth++;
            if (c == ')') depth--;

            boolean isBoundary = depth == 0 && (c == '+' || c == '-') && i > start;
            if (isBoundary || end) {
                String raw = expr.substring(start, i).trim();
                if (!raw.isEmpty()) {
                    Term t = parseTerm(sign, raw);
                    if (t == null) return java.util.List.of(); // gagal parse → unavailable
                    terms.add(t);
                }
                if (!end) sign = (c == '-') ? -1 : 1;
                start = i + 1;
            }
        }
        return terms;
    }

    private static final Pattern COEF_PATTERN = Pattern.compile("^(-?\\d*\\.?\\d*)\\*?(.*)$");

    private Term parseTerm(int sign, String raw) {
        // Pisahkan koefisien numerik di depan, misal "3*x^2" -> coef=3, body="x^2"
        Matcher m = COEF_PATTERN.matcher(raw);
        if (!m.matches()) return null;

        String coefStr = m.group(1);
        String body = m.group(2);

        double coef = 1.0;
        if (!coefStr.isEmpty() && !coefStr.equals("-")) {
            try { coef = Double.parseDouble(coefStr); }
            catch (NumberFormatException e) { return null; }
        }
        if (body.isEmpty()) {
            // suku berupa angka konstan saja, misal "5"
            return new Term(sign, coef, "1");
        }
        return new Term(sign, coef, body);
    }

    private String formatCoef(double c) {
        if (c == 1.0) return "";
        if (c == Math.floor(c)) return String.valueOf((long) c) + "·";
        return String.format("%.3f·", c);
    }

    // =========================================================
    //  ANTI-DERIVATIF UNTUK SETIAP BENTUK BODY
    // =========================================================

    private interface Antiderivative {
        double evaluate(double x);
        String label();
    }

    private static final Pattern POWER_PATTERN = Pattern.compile("^x\\^(-?\\d+\\.?\\d*)$");

    /**
     * Mengenali body suku (tanpa koefisien) dan mengembalikan anti-derivatifnya.
     * body sudah dinormalisasi, contoh: "x^2", "x", "1", "sin(x)", "e^x", "1/x"
     */
    private Antiderivative antiderivativeOf(String body) {
        switch (body) {
            case "1":
                return new Antiderivative() {
                    public double evaluate(double x) { return x; }
                    public String label() { return "x"; }
                };
            case "x":
                return new Antiderivative() {
                    public double evaluate(double x) { return x * x / 2.0; }
                    public String label() { return "x²/2"; }
                };
            case "sin(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return -Math.cos(x); }
                    public String label() { return "-cos(x)"; }
                };
            case "cos(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return Math.sin(x); }
                    public String label() { return "sin(x)"; }
                };
            case "tan(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return -Math.log(Math.abs(Math.cos(x))); }
                    public String label() { return "-ln|cos(x)|"; }
                };
            case "e^x":
            case "exp(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return Math.exp(x); }
                    public String label() { return "eˣ"; }
                };
            case "1/x":
                return new Antiderivative() {
                    public double evaluate(double x) { return Math.log(Math.abs(x)); }
                    public String label() { return "ln|x|"; }
                };
            case "sqrt(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return (2.0 / 3.0) * Math.pow(x, 1.5); }
                    public String label() { return "(2/3)x^1.5"; }
                };
            case "sinh(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return Math.cosh(x); }
                    public String label() { return "cosh(x)"; }
                };
            case "cosh(x)":
                return new Antiderivative() {
                    public double evaluate(double x) { return Math.sinh(x); }
                    public String label() { return "sinh(x)"; }
                };
        }

        // Pola pangkat: x^n  (n != -1, karena -1 sudah ditangani via "1/x")
        Matcher pm = POWER_PATTERN.matcher(body);
        if (pm.matches()) {
            double n = Double.parseDouble(pm.group(1));
            if (n == -1.0) return null; // sudah dihandle di atas sebagai "1/x"
            double newPower = n + 1.0;
            return new Antiderivative() {
                public double evaluate(double x) { return Math.pow(x, newPower) / newPower; }
                public String label() { return "x^" + trimTrailingZero(newPower) + "/" + trimTrailingZero(newPower); }
            };
        }

        return null; // tidak dikenali
    }

    private String trimTrailingZero(double v) {
        if (v == Math.floor(v)) return String.valueOf((long) v);
        return String.valueOf(v);
    }

    // =========================================================
    //  NORMALISASI EKSPRESI
    // =========================================================

    private String normalize(String expr) {
        return expr.toLowerCase().trim()
                   .replace(" ", "")
                   .replace("**", "^");
    }
}
