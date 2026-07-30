package com.example.inventoryservice.entity.dto.res;

import com.example.inventoryservice.entity.Ingredient;
import com.example.inventoryservice.entity.enums.BaseUnit;
import com.example.inventoryservice.entity.enums.IngredientCategory;
import com.example.inventoryservice.entity.enums.ManagementType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class IngredientResponse {

    private UUID id;
    private String name;
    private BaseUnit baseUnit;
    private Double currentQty;
    private Double averageCost;
    private Double minThreshold;
    private IngredientCategory category;
    private ManagementType managementType;
    private boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;

    // Tính giá trị tồn kho = currentQty × averageCost
    public Double getInventoryValue() {
        return currentQty != null && averageCost != null ? currentQty * averageCost : 0.0;
    }

    // Cảnh báo tồn kho thấp
    public boolean isLowStock() {
        return currentQty != null && minThreshold != null && currentQty <= minThreshold;
    }

    public static IngredientResponse from(Ingredient i) {
        return IngredientResponse.builder()
                .id(i.getId())
                .name(i.getName())
                .baseUnit(i.getBaseUnit())
                .currentQty(i.getCurrentQty())
                .averageCost(i.getAverageCost())
                .minThreshold(i.getMinThreshold())
                .category(i.getCategory())
                .managementType(i.getManagementType())
                .isActive(i.isActive())
                .createdAt(i.getCreatedAt())
                .updatedAt(i.getUpdatedAt())
                .build();
    }
}
