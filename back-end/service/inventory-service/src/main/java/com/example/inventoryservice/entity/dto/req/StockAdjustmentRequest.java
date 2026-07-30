package com.example.inventoryservice.entity.dto.req;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class StockAdjustmentRequest {

    @NotNull(message = "ID nguyên liệu không được để trống")
    private UUID ingredientId;

    @NotNull(message = "Số lượng điều chỉnh không được để trống")
    private Double adjustmentQty;

    private String note;
}
