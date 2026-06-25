package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.InventoryImportRequest;
import com.example.inventoryservice.entity.dto.res.InventoryImportResponse;
import com.example.inventoryservice.service.InventoryImportService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/inventory/imports")
@RequiredArgsConstructor
public class InventoryImportController {

    private final InventoryImportService inventoryImportService;

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<InventoryImportResponse> importStock(
            @RequestBody @Valid InventoryImportRequest req,
            @AuthenticationPrincipal Jwt jwt) throws MessageException {
        String importedBy = jwt.getSubject();
        return ResponseEntity.ok(inventoryImportService.importStock(req, importedBy));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<InventoryImportResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long ingredientId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) throws MessageException {
        return ResponseEntity.ok(inventoryImportService.getAll(page, size, ingredientId, from, to));
    }
}
