package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.InventoryImportRequest;
import com.example.inventoryservice.entity.dto.res.InventoryImportResponse;
import com.example.inventoryservice.service.InventoryImportService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

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

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Void> deleteImport(@PathVariable UUID id) throws MessageException {
        inventoryImportService.deleteImport(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<InventoryImportResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) UUID ingredientId,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to) throws MessageException {
        Instant fromInstant = from != null && !from.isBlank() ? Instant.parse(from) : null;
        Instant toInstant   = to   != null && !to.isBlank()   ? Instant.parse(to)   : null;
        return ResponseEntity.ok(inventoryImportService.getAll(page, size, ingredientId, fromInstant, toInstant));
    }
}
