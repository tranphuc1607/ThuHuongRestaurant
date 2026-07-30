package com.example.inventoryservice.controller;

import com.example.inventoryservice.entity.dto.req.RecipeCreateRequest;
import com.example.inventoryservice.entity.dto.res.RecipeResponse;
import com.example.inventoryservice.service.RecipeService;
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
@RequestMapping("/api/v1/inventory/recipes")
@RequiredArgsConstructor
public class RecipeController {

    private final RecipeService recipeService;

    @GetMapping("/product/{productId}")
    @PreAuthorize("hasAuthority('ROLE_EMPLOYEE') or hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<RecipeResponse>> getByProductId(@PathVariable UUID productId) {
        return ResponseEntity.ok(recipeService.getByProductId(productId));
    }
    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<RecipeResponse> create(@RequestBody @Valid RecipeCreateRequest req) throws MessageException {
        return ResponseEntity.ok(recipeService.create(req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Map<String, String>> delete(@PathVariable UUID id) throws MessageException {
        recipeService.delete(id);
        return ResponseEntity.ok(Map.of("message", "Đã xóa công thức"));
    }

    @DeleteMapping("/product/{productId}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<Map<String, String>> deleteByProductId(@PathVariable UUID productId) {
        recipeService.deleteByProductId(productId);
        return ResponseEntity.ok(Map.of("message", "Đã xóa tất cả công thức của sản phẩm"));
    }
}
