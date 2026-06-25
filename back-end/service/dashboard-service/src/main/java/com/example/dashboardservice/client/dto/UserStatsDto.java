package com.example.dashboardservice.client.dto;

import lombok.Data;

@Data
public class UserStatsDto {
    private long activeAdmin;
    private long activeEmployee;
    private long totalActive;
}
