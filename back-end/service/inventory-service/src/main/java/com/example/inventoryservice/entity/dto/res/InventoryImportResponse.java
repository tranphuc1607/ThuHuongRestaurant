package com.example.inventoryservice.entity.dto.res;

import com.example.inventoryservice.entity.InventoryImport;
import com.example.inventoryservice.entity.enums.BaseUnit;
import com.example.inventoryservice.entity.enums.SaleUnit;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class InventoryImportResponse {

    private UUID id;
    private UUID ingredientId;
    private String ingredientName;
    private BaseUnit ingredientBaseUnit;
    private Double quantityImported;      // số lượng theo đơn vị cơ sở
    private SaleUnit saleUnit;            // đơn vị nhập thực tế (null = đơn vị cơ sở)
    private Double saleQtyImported;       // số lượng theo đơn vị nhập
    private Double unitCost;              // đơn giá theo đơn vị nhập
    private Double totalCost;
    private String purchaseNote;
    private String importedBy;
    private String note;
    private Double ingredientCurrentQty;
    private Double ingredientAverageCost;
    private Instant createdAt;

    public static InventoryImportResponse from(InventoryImport imp) {
        return InventoryImportResponse.builder()
                .id(imp.getId())
                .ingredientId(imp.getIngredient().getId())
                .ingredientName(imp.getIngredient().getName())
                .ingredientBaseUnit(imp.getIngredient().getBaseUnit())
                .quantityImported(imp.getQuantityImported())
                .saleUnit(imp.getSaleUnit())
                .saleQtyImported(imp.getSaleQtyImported())
                .unitCost(imp.getUnitCost())
                .totalCost(imp.getTotalCost())
                .purchaseNote(imp.getPurchaseNote())
                .importedBy(imp.getImportedBy())
                .note(imp.getNote())
                .ingredientCurrentQty(imp.getIngredient().getCurrentQty())
                .ingredientAverageCost(imp.getIngredient().getAverageCost())
                .createdAt(imp.getCreatedAt())
                .build();
    }
}
