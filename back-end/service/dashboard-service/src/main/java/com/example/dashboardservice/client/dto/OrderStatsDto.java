package com.example.dashboardservice.client.dto;

import lombok.Data;

import java.util.List;

@Data
public class OrderStatsDto {
    private long open;
    private long paid;
    private long cancelled;
    private long occupiedTables;
    private List<TopProductDto> topProducts;
}
