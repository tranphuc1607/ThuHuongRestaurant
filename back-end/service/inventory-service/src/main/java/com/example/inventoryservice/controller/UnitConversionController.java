package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.UnitConversionCreateRequest;
import com.example.inventoryservice.entity.dto.req.UnitConversionUpdateRequest;
import com.example.inventoryservice.entity.dto.res.UnitConversionResponse;
import com.example.inventoryservice.service.UnitConversionService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/inventory/conversions")
@RequiredArgsConstructor
public class UnitConversionController {

    private final UnitConversionService unitConversionService;

    @GetMapping("/ingredient/{ingredientId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<UnitConversionResponse>> getByIngredient(@PathVariable UUID ingredientId) throws MessageException {
        return ResponseEntity.ok(unitConversionService.getByIngredientId(ingredientId));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<UnitConversionResponse> create(@RequestBody @Valid UnitConversionCreateRequest req) throws MessageException {
        return ResponseEntity.ok(unitConversionService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<UnitConversionResponse> update(
            @PathVariable UUID id,
            @RequestBody @Valid UnitConversionUpdateRequest req) throws MessageException {
        return ResponseEntity.ok(unitConversionService.update(id, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable UUID id) throws MessageException {
        unitConversionService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Đã xóa quy đổi đơn vị"));
    }
}
