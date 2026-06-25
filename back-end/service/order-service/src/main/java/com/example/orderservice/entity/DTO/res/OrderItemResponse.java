package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.OrderItem;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrderItemResponse {

    private Long id;
    private Long productId;
    private String productName;
    private Double productPrice;
    private Integer quantity;
    private String saleUnit;
    private Double itemTotal;

    public static OrderItemResponse from(OrderItem item) {
        return OrderItemResponse.builder()
                .id(item.getId())
                .productId(item.getProductId())
                .productName(item.getProductName())
                .productPrice(item.getProductPrice())
                .quantity(item.getQuantity())
                .saleUnit(item.getSaleUnit())
                .itemTotal(item.getItemTotal())
                .build();
    }
}
