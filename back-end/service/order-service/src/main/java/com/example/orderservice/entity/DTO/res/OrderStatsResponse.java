package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class OrderStatsResponse {
    private long open;
    private long paid;
    private long cancelled;
    private long occupiedTables;
    private List<TopProductItem> topProducts;
}
