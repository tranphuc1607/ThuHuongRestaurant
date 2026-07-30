package com.example.inventoryservice.entity.dto.res;

import com.example.inventoryservice.entity.UnitConversion;
import com.example.inventoryservice.entity.enums.SaleUnit;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class UnitConversionResponse {

    private UUID id;
    private UUID ingredientId;
    private String ingredientName;
    private SaleUnit saleUnit;
    private Double baseQtyPerSaleUnit;
    private String note;
    private Instant createdAt;

    public static UnitConversionResponse from(UnitConversion uc) {
        return UnitConversionResponse.builder()
                .id(uc.getId())
                .ingredientId(uc.getIngredient().getId())
                .ingredientName(uc.getIngredient().getName())
                .saleUnit(uc.getSaleUnit())
                .baseQtyPerSaleUnit(uc.getBaseQtyPerSaleUnit())
                .note(uc.getNote())
                .createdAt(uc.getCreatedAt())
                .build();
    }
}
