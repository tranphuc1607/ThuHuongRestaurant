package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.IngredientCreateRequest;
import com.example.inventoryservice.entity.dto.req.IngredientUpdateRequest;
import com.example.inventoryservice.entity.dto.res.IngredientResponse;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import com.example.inventoryservice.service.IngredientService;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/inventory/ingredients")
@RequiredArgsConstructor
public class IngredientController {

    private final IngredientService ingredientService;

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<IngredientResponse>> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) IngredientCategory category,
            @RequestParam(required = false) ManagementType managementType) {
        if (category != null) {
            return ResponseEntity.ok(ingredientService.getByCategory(category, page, size));
        }
        if (managementType != null) {
            return ResponseEntity.ok(ingredientService.getByManagementType(managementType, page, size));
        }
        return ResponseEntity.ok(ingredientService.getAllIngredients(page, size));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Page<IngredientResponse>> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(ingredientService.search(keyword, page, size));
    }

    @GetMapping("/low-stock")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<IngredientResponse>> getLowStock() {
        return ResponseEntity.ok(ingredientService.getLowStockIngredients());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<IngredientResponse> getById(@PathVariable Long id) throws MessageException {
        return ResponseEntity.ok(ingredientService.getById(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<IngredientResponse> create(@RequestBody @Valid IngredientCreateRequest req) {
        return ResponseEntity.ok(ingredientService.create(req));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<IngredientResponse> update(
            @PathVariable Long id,
            @RequestBody @Valid IngredientUpdateRequest req) throws MessageException {
        return ResponseEntity.ok(ingredientService.update(id, req));
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Map<String, String>> deactivate(@PathVariable Long id) throws MessageException {
        ingredientService.deactivate(id);
        return ResponseEntity.ok(Map.of("message", "Đã ngừng sử dụng nguyên liệu"));
    }
}
