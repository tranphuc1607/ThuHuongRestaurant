package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateOrderRequest {

    private UUID tableId; // nullable — cho phép tạo đơn không gắn bàn (quét hóa đơn viết tay)

    private String note;

    private Integer guestCount;
}
