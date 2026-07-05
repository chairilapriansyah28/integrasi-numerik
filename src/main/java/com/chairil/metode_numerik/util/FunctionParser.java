package com.chairil.metode_numerik.util;

import org.springframework.stereotype.Component;

import java.util.function.DoubleUnaryOperator;

/**
 * Parser ekspresi matematika sederhana menggunakan recursive descent.
 *
 * Mendukung:
 *  - Operasi: +, -, *, /, ^
 *  - Fungsi: sin, cos, tan, sqrt, log, ln, exp, abs
 *  - Konstanta: pi, e
 *  - Variabel: x
 *  - Tanda kurung
 */
@Component
public class FunctionParser {

    public DoubleUnaryOperator parse(String expression) {
        String normalized = normalize(expression);
        return (x) -> {
            try {
                return new ExpressionEvaluator(normalized, x).evaluate();
            } catch (Exception e) {
                throw new IllegalArgumentException("Fungsi tidak valid: " + e.getMessage());
            }
        };
    }

    /** Normalisasi ekspresi: lowercase, hapus spasi, dll. */
    private String normalize(String expr) {
        return expr.toLowerCase().trim()
                   .replace(" ", "")
                   .replace("**", "^");
    }

    // =====================================================
    //  Inner class: Recursive Descent Evaluator
    // =====================================================
    private static class ExpressionEvaluator {
        private final String expr;
        private final double x;
        private int pos = 0;

        ExpressionEvaluator(String expr, double x) {
            this.expr = expr;
            this.x = x;
        }

        double evaluate() {
            double val = parseAddSub();
            if (pos < expr.length()) {
                throw new RuntimeException("Karakter tidak diharapkan: " + expr.charAt(pos));
            }
            return val;
        }

        // Level 1: + dan -
        private double parseAddSub() {
            double left = parseMulDiv();
            while (pos < expr.length()) {
                char c = expr.charAt(pos);
                if (c == '+') { pos++; left += parseMulDiv(); }
                else if (c == '-') { pos++; left -= parseMulDiv(); }
                else break;
            }
            return left;
        }

        // Level 2: * dan /
        private double parseMulDiv() {
            double left = parsePower();
            while (pos < expr.length()) {
                char c = expr.charAt(pos);
                if (c == '*') { pos++; left *= parsePower(); }
                else if (c == '/') {
                    pos++;
                    double r = parsePower();
                    if (r == 0) throw new ArithmeticException("Pembagian dengan nol");
                    left /= r;
                }
                else break;
            }
            return left;
        }

        // Level 3: ^ (pangkat, right-associative)
        private double parsePower() {
            double base = parseUnary();
            if (pos < expr.length() && expr.charAt(pos) == '^') {
                pos++;
                double exp = parseUnary();
                return Math.pow(base, exp);
            }
            return base;
        }

        // Level 4: unary -, fungsi, angka, variabel
        private double parseUnary() {
            if (pos < expr.length() && expr.charAt(pos) == '-') {
                pos++;
                return -parsePrimary();
            }
            if (pos < expr.length() && expr.charAt(pos) == '+') {
                pos++;
            }
            return parsePrimary();
        }

        // Level 5: primary
        private double parsePrimary() {
            if (pos >= expr.length()) throw new RuntimeException("Ekspresi tidak lengkap");
            char c = expr.charAt(pos);

            // Tanda kurung
            if (c == '(') {
                pos++;
                double val = parseAddSub();
                if (pos >= expr.length() || expr.charAt(pos) != ')') {
                    throw new RuntimeException("Tanda kurung tidak cocok");
                }
                pos++;
                return val;
            }

            // Angka
            if (Character.isDigit(c) || c == '.') {
                return parseNumber();
            }

            // Fungsi atau variabel atau konstanta
            if (Character.isLetter(c)) {
                return parseFunctionOrConstant();
            }

            throw new RuntimeException("Karakter tidak dikenal: " + c);
        }

        private double parseNumber() {
            int start = pos;
            while (pos < expr.length() &&
                   (Character.isDigit(expr.charAt(pos)) || expr.charAt(pos) == '.')) {
                pos++;
            }
            return Double.parseDouble(expr.substring(start, pos));
        }

        private double parseFunctionOrConstant() {
            int start = pos;
            while (pos < expr.length() && Character.isLetter(expr.charAt(pos))) {
                pos++;
            }
            String name = expr.substring(start, pos);

            // Konstanta
            switch (name) {
                case "pi": return Math.PI;
                case "e":  return Math.E;
                case "x":  return x;
            }

            // Fungsi satu argumen
            if (pos < expr.length() && expr.charAt(pos) == '(') {
                pos++; // lewati '('
                double arg = parseAddSub();
                if (pos >= expr.length() || expr.charAt(pos) != ')') {
                    throw new RuntimeException("Kurung tutup kurang pada fungsi " + name);
                }
                pos++; // lewati ')'

                return switch (name) {
                    case "sin"  -> Math.sin(arg);
                    case "cos"  -> Math.cos(arg);
                    case "tan"  -> Math.tan(arg);
                    case "sqrt" -> {
                        if (arg < 0) throw new ArithmeticException("sqrt argumen negatif");
                        yield Math.sqrt(arg);
                    }
                    case "log"  -> Math.log10(arg);
                    case "ln"   -> Math.log(arg);
                    case "exp"  -> Math.exp(arg);
                    case "abs"  -> Math.abs(arg);
                    case "sinh" -> Math.sinh(arg);
                    case "cosh" -> Math.cosh(arg);
                    default -> throw new RuntimeException("Fungsi tidak dikenal: " + name);
                };
            }

            // Variabel 'x' tanpa kurung
            if (name.equals("x")) return x;

            throw new RuntimeException("Nama tidak dikenal: " + name);
        }
    }
}
