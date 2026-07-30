package com.example.inventoryservice.entity.dto.req;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class RecipeCreateRequest {

    @NotNull(message = "ID sản phẩm không được để trống")
    private UUID productId;

    @NotNull(message = "ID nguyên liệu không được để trống")
    private UUID ingredientId;

    @NotNull(message = "Định mức không được để trống")
    @Min(value = 0, message = "Định mức không được âm")
    private Double amountRequired;

    private String note;
}
