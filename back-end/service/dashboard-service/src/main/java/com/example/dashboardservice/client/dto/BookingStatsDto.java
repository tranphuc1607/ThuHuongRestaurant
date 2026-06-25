package com.example.dashboardservice.client.dto;

import lombok.Data;

@Data
public class BookingStatsDto {
    private long pendingPayment;
    private long confirmedToday;
    private long upcomingIn2Hours;
}
