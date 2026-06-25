package com.example.dashboardservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class DashboardResponse {

    private RevenueStats revenue;
    private OrderStats orders;
    private BookingStats bookings;
    private InventoryAlertStats inventory;
    private UserStats users;

    @Data
    @Builder
    public static class RevenueStats {
        private double today;
        private double yesterday;
        private double todayChangePercent;

        private double thisWeek;
        private double lastWeek;
        private double weekChangePercent;

        private double thisMonth;
        private double lastMonth;
        private double monthChangePercent;

        private long todayTransactions;
        private Map<String, Double> todayByMethod;
    }

    @Data
    @Builder
    public static class OrderStats {
        private long open;
        private long paid;
        private long cancelled;
        private long occupiedTables;
        private List<TopProduct> topProducts;
    }

    @Data
    @Builder
    public static class TopProduct {
        private String productName;
        private long quantity;
    }

    @Data
    @Builder
    public static class BookingStats {
        private long pendingPayment;
        private long confirmedToday;
        private long upcomingIn2Hours;
    }

    @Data
    @Builder
    public static class InventoryAlertStats {
        private int lowStockCount;
        private List<String> lowStockItems;
    }

    @Data
    @Builder
    public static class UserStats {
        private long activeAdmin;
        private long activeEmployee;
        private long totalActive;
    }
}
