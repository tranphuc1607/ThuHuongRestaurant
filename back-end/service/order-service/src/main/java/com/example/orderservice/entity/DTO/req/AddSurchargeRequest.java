package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AddSurchargeRequest {

    @NotBlank(message = "Tên khoản phụ thu không được để trống")
    private String name;

    @NotNull(message = "Đơn giá không được để trống")
    @Min(value = 0, message = "Đơn giá phải >= 0")
    private Double unitPrice;

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng phải >= 1")
    private Integer quantity;

    private String reason;
}
