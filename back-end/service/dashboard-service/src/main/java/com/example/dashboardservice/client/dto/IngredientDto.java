package com.example.dashboardservice.client.dto;

import lombok.Data;

@Data
public class IngredientDto {
    private Long id;
    private String name;
    private String unit;
    private Double stockQuantity;
    private Double minStock;
}
