package com.example.inventoryservice.entity.dto.res;

import com.example.inventoryservice.entity.Recipe;
import com.example.inventoryservice.entity.enums.BaseUnit;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class RecipeResponse {

    private Long id;
    private Long productId;
    private Long ingredientId;
    private String ingredientName;
    private BaseUnit ingredientBaseUnit;
    private Double amountRequired;
    private String note;
    private Instant createdAt;

    public static RecipeResponse from(Recipe r) {
        return RecipeResponse.builder()
                .id(r.getId())
                .productId(r.getProductId())
                .ingredientId(r.getIngredient().getId())
                .ingredientName(r.getIngredient().getName())
                .ingredientBaseUnit(r.getIngredient().getBaseUnit())
                .amountRequired(r.getAmountRequired())
                .note(r.getNote())
                .createdAt(r.getCreatedAt())
                .build();
    }
}
