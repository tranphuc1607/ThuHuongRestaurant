package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.SaleUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UnitConversionCreateRequest {

    @NotNull(message = "ID nguyên liệu không được để trống")
    private Long ingredientId;

    @NotNull(message = "Đơn vị bán không được để trống")
    private SaleUnit saleUnit;

    @NotNull(message = "Tỷ lệ quy đổi không được để trống")
    @DecimalMin(value = "0.0001", message = "Tỷ lệ quy đổi phải lớn hơn 0")
    private Double baseQtyPerSaleUnit;

    private String note;
}
