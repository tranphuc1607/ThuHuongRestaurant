package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TopProductItem {
    private String productName;
    private Long quantity;
}
