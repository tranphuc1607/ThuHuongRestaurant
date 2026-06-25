package com.example.inventoryservice.entity.dto.res;

import com.example.inventoryservice.entity.StockDeduction;
import com.example.inventoryservice.entity.enums.DeductionReason;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class StockDeductionResponse {

    private Long id;
    private Long ingredientId;
    private String ingredientName;
    private Double qtyDeducted;
    private DeductionReason reason;
    private String referenceId;
    private String deductedBy;
    private String note;
    private Instant createdAt;

    public static StockDeductionResponse from(StockDeduction d) {
        return StockDeductionResponse.builder()
                .id(d.getId())
                .ingredientId(d.getIngredient().getId())
                .ingredientName(d.getIngredient().getName())
                .qtyDeducted(d.getQtyDeducted())
                .reason(d.getReason())
                .referenceId(d.getReferenceId())
                .deductedBy(d.getDeductedBy())
                .note(d.getNote())
                .createdAt(d.getCreatedAt())
                .build();
    }
}
