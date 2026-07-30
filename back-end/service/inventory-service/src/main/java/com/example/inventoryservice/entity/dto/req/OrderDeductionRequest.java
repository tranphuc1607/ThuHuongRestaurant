package com.example.inventoryservice.entity.dto.req;

import com.example.inventoryservice.entity.enums.SaleUnit;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class OrderDeductionRequest {

    @NotBlank(message = "ID đơn hàng không được để trống")
    private String orderId;

    @NotEmpty(message = "Danh sách món hàng không được trống")
    @Valid
    private List<OrderItem> items;

    @Data
    public static class OrderItem {

        @NotNull(message = "ID sản phẩm không được để trống")
        private UUID productId;

        @NotNull(message = "Số lượng không được để trống")
        @Min(value = 1, message = "Số lượng phải ít nhất là 1")
        private Integer quantity;

        @NotNull(message = "Đơn vị bán không được để trống")
        private SaleUnit saleUnit;
    }
}
