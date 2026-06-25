package com.example.inventoryservice.entity.dto.req;

import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

@Data
public class UnitConversionUpdateRequest {

    @DecimalMin(value = "0.0001", message = "Tỷ lệ quy đổi phải lớn hơn 0")
    private Double baseQtyPerSaleUnit;

    private String note;
}
