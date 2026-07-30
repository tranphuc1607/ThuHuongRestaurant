package com.example.orderservice.client.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class OrderDeductionPayload {

    private String orderId;
    private List<OrderItem> items;

    @Data
    @Builder
    public static class OrderItem {
        private UUID productId;
        private Integer quantity;
        private String saleUnit;
    }
}
