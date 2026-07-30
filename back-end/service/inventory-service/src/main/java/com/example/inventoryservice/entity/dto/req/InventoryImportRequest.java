package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.SaleUnit;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InventoryImportRequest {

    @NotNull(message = "ID nguyên liệu không được để trống")
    private UUID ingredientId;

    @NotNull(message = "Số lượng nhập không được để trống")
    @DecimalMin(value = "0.0001", message = "Số lượng nhập phải lớn hơn 0")
    private Double quantityImported;

    // Đơn vị nhập hàng (null = nhập theo đơn vị cơ sở)
    private SaleUnit saleUnit;

    @NotNull(message = "Đơn giá không được để trống")
    @DecimalMin(value = "0", inclusive = false, message = "Đơn giá phải lớn hơn 0")
    private Double unitCost;

    private String purchaseNote;

    private String note;
}
