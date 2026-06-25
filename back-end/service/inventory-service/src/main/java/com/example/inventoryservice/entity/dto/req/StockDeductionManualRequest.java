package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.DeductionReason;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StockDeductionManualRequest {

    @NotNull(message = "ID nguyên liệu không được để trống")
    private Long ingredientId;

    @NotNull(message = "Số lượng xuất không được để trống")
    @DecimalMin(value = "0.0001", message = "Số lượng xuất phải lớn hơn 0")
    private Double qtyDeducted;

    @NotNull(message = "Lý do xuất kho không được để trống")
    private DeductionReason reason;

    private String note;
}
