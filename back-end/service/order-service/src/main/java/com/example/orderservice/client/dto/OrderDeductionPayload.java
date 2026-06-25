package com.example.orderservice.client.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderDeductionPayload {

    private String orderId;
    private List<OrderItem> items;

    @Data
    @Builder
    public static class OrderItem {
        private Long productId;
        private Integer quantity;
        private String saleUnit;
    }
}
