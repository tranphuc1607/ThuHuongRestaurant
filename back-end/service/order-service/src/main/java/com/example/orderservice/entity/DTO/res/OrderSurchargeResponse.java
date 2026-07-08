package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.OrderSurcharge;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class OrderSurchargeResponse {

    private Long id;
    private String name;
    private Double unitPrice;
    private Integer quantity;
    private Double amount;
    private String reason;
    private Instant createdAt;

    public static OrderSurchargeResponse from(OrderSurcharge s) {
        return OrderSurchargeResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .unitPrice(s.getUnitPrice())
                .quantity(s.getQuantity())
                .amount(s.getAmount())
                .reason(s.getReason())
                .createdAt(s.getCreatedAt())
                .build();
    }
}
