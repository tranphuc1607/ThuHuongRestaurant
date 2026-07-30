package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateBookingItemRequest {

    @NotNull(message = "Vui lòng chọn sản phẩm")
    private UUID productId;

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng phải ít nhất là 1")
    private Integer quantity;

    @NotBlank(message = "Đơn vị bán không được để trống")
    private String saleUnit;
}
