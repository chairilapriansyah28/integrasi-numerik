package com.chairil.metode_numerik.controller;

import com.chairil.metode_numerik.model.request.IntegrationRequest;
import com.chairil.metode_numerik.model.response.IntegrationResponse;
import com.chairil.metode_numerik.service.IntegrationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST Controller untuk endpoint integrasi numerik.
 * Base URL: /api/integration
 */
@RestController
@RequestMapping("/api/integration")
@CrossOrigin(origins = "*")   // izinkan request dari frontend
public class IntegrationController {

    private final IntegrationService integrationService;

    public IntegrationController(IntegrationService integrationService) {
        this.integrationService = integrationService;
    }

    /**
     * POST /api/integration/calculate
     * Body: IntegrationRequest (JSON)
     */
    @PostMapping("/calculate")
    public ResponseEntity<?> calculate(@Valid @RequestBody IntegrationRequest request) {
        IntegrationResponse response = integrationService.calculate(request);
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/integration/health
     * Cek apakah backend aktif.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "NumeriCalc Backend",
            "version", "1.0.0"
        ));
    }

    /**
     * GET /api/integration/methods
     * Daftar metode yang tersedia.
     */
    @GetMapping("/methods")
    public ResponseEntity<?> methods() {
        return ResponseEntity.ok(Map.of(
            "methods", new Object[]{
                Map.of(
                    "id", "rectangle",
                    "name", "Kaidah Segiempat",
                    "variants", new String[]{"left", "right"},
                    "errorOrder", "O(h)"
                ),
                Map.of(
                    "id", "midpoint",
                    "name", "Kaidah Titik Tengah",
                    "errorOrder", "O(h²)"
                )
            }
        ));
    }
}
