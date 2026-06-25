package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BookingStatsResponse {
    private long pendingPayment;
    private long confirmedToday;
    private long upcomingIn2Hours;
}
