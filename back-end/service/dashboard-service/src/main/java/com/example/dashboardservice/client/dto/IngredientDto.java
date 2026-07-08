package com.example.dashboardservice.client.dto;

import lombok.Data;

@Data
public class IngredientDto {
    private Long id;
    private String name;
    private String baseUnit;    // khớp với IngredientResponse.baseUnit
    private Double currentQty;  // khớp với IngredientResponse.currentQty
    private Double minThreshold; // khớp với IngredientResponse.minThreshold
}
