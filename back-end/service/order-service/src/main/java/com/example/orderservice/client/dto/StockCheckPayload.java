package com.example.orderservice.client.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class StockCheckPayload {

    private List<Item> items;

    @Data
    @Builder
    public static class Item {
        private Long productId;
        private Integer quantity;
        private String saleUnit;
    }
}
