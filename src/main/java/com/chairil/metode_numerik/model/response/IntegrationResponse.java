package com.chairil.metode_numerik.model.response;

import java.util.List;

/**
 * DTO untuk response hasil perhitungan integrasi numerik.
 */
public class IntegrationResponse {

    private double result;
    private double h;
    private int n;
    private String method;
    private String variant;
    private double errorEstimate;
    private List<StepDetail> steps;

    // ===== Nilai Eksak (anti-derivatif analitik) =====
    private boolean exactAvailable;
    private double exactValue;
    private String antiderivative;
    private double trueError;        // |hasil_numerik - nilai_eksak|
    private double trueErrorPercent; // dalam persen relatif terhadap nilai eksak

    // ===== Pencarian n Optimal =====
    private Integer suggestedN;       // n minimum agar errorEstimate <= target tolerance
    private Double targetTolerance;   // toleransi yang dipakai untuk pencarian

    // ===== Inner class untuk langkah-langkah =====
    public static class StepDetail {
        private int index;
        private String xi;
        private String fxi;

        public StepDetail(int index, double xi, double fxi) {
            this.index = index;
            this.xi = String.format("%.6f", xi);
            this.fxi = String.format("%.6f", fxi);
        }

        public int getIndex() { return index; }
        public String getXi() { return xi; }
        public String getFxi() { return fxi; }
    }

    // ===== Getters & Setters =====
    public double getResult() { return result; }
    public void setResult(double result) { this.result = result; }

    public double getH() { return h; }
    public void setH(double h) { this.h = h; }

    public int getN() { return n; }
    public void setN(int n) { this.n = n; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getVariant() { return variant; }
    public void setVariant(String variant) { this.variant = variant; }

    public double getErrorEstimate() { return errorEstimate; }
    public void setErrorEstimate(double errorEstimate) { this.errorEstimate = errorEstimate; }

    public List<StepDetail> getSteps() { return steps; }
    public void setSteps(List<StepDetail> steps) { this.steps = steps; }

    public boolean isExactAvailable() { return exactAvailable; }
    public void setExactAvailable(boolean exactAvailable) { this.exactAvailable = exactAvailable; }

    public double getExactValue() { return exactValue; }
    public void setExactValue(double exactValue) { this.exactValue = exactValue; }

    public String getAntiderivative() { return antiderivative; }
    public void setAntiderivative(String antiderivative) { this.antiderivative = antiderivative; }

    public double getTrueError() { return trueError; }
    public void setTrueError(double trueError) { this.trueError = trueError; }

    public double getTrueErrorPercent() { return trueErrorPercent; }
    public void setTrueErrorPercent(double trueErrorPercent) { this.trueErrorPercent = trueErrorPercent; }

    public Integer getSuggestedN() { return suggestedN; }
    public void setSuggestedN(Integer suggestedN) { this.suggestedN = suggestedN; }

    public Double getTargetTolerance() { return targetTolerance; }
    public void setTargetTolerance(Double targetTolerance) { this.targetTolerance = targetTolerance; }
}
