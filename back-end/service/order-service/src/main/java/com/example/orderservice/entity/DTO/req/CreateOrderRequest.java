package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateOrderRequest {

    @NotNull(message = "ID bàn không được để trống")
    private Long tableId;

    private String note;

    private Integer guestCount;
}
