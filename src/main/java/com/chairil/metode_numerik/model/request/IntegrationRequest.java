package com.chairil.metode_numerik.model.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO untuk request perhitungan integrasi numerik.
 */
public class IntegrationRequest {

    @NotBlank(message = "Fungsi f(x) tidak boleh kosong")
    private String function;

    @NotNull(message = "Batas bawah (a) wajib diisi")
    private Double lowerBound;

    @NotNull(message = "Batas atas (b) wajib diisi")
    private Double upperBound;

    @NotNull
    @Min(value = 1, message = "n minimal 1")
    private Integer n;

    /** "rectangle" | "midpoint" | "trapezoid" */
    @NotBlank
    private String method;

    /** "left" | "right" — hanya dipakai jika method=rectangle */
    private String variant = "left";

    /**
     * Toleransi target untuk pencarian n optimal (opsional).
     * Jika diisi, backend akan mencari n minimum agar error estimasi <= nilai ini.
     */
    private Double targetTolerance;

    // === Getters & Setters ===
    public String getFunction() { return function; }
    public void setFunction(String function) { this.function = function; }

    public Double getLowerBound() { return lowerBound; }
    public void setLowerBound(Double lowerBound) { this.lowerBound = lowerBound; }

    public Double getUpperBound() { return upperBound; }
    public void setUpperBound(Double upperBound) { this.upperBound = upperBound; }

    public Integer getN() { return n; }
    public void setN(Integer n) { this.n = n; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getVariant() { return variant; }
    public void setVariant(String variant) { this.variant = variant; }

    public Double getTargetTolerance() { return targetTolerance; }
    public void setTargetTolerance(Double targetTolerance) { this.targetTolerance = targetTolerance; }
}
