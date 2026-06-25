package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.BaseUnit;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class IngredientUpdateRequest {

    @Size(max = 200)
    private String name;

    private BaseUnit baseUnit;

    private IngredientCategory category;

    private ManagementType managementType;

    @Min(value = 0)
    private Double minThreshold;
}
