package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.BookingItem;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class BookingItemResponse {

    private UUID id;
    private UUID productId;
    private String productName;
    private Double productPrice;
    private Integer quantity;
    private String saleUnit;
    private Double itemTotal;

    public static BookingItemResponse from(BookingItem item) {
        return BookingItemResponse.builder()
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
