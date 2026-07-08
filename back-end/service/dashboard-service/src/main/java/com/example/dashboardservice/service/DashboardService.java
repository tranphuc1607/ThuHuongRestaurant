package com.example.dashboardservice.service;

import com.example.dashboardservice.client.*;
import com.example.dashboardservice.client.dto.*;
import com.example.dashboardservice.client.dto.RevenuePeriodDto;
import com.example.dashboardservice.entity.DTO.res.DashboardResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final ZoneId VN = ZoneId.of("Asia/Ho_Chi_Minh");

    private final PaymentServiceClient paymentClient;
    private final OrderServiceClient orderClient;
    private final InventoryServiceClient inventoryClient;
    private final UserServiceClient userClient;

    public DashboardResponse getSummary() {
        Instant now = Instant.now();
        LocalDate today = now.atZone(VN).toLocalDate();

        // Today
        Instant todayStart    = today.atStartOfDay(VN).toInstant();
        Instant yesterdayStart = today.minusDays(1).atStartOfDay(VN).toInstant();
        Instant yesterdayEnd  = todayStart.minusSeconds(1);

        // Week (Mon–Sun)
        LocalDate weekMonday  = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant weekStart     = weekMonday.atStartOfDay(VN).toInstant();
        Instant lastWeekStart = weekMonday.minusWeeks(1).atStartOfDay(VN).toInstant();
        Instant lastWeekEnd   = weekStart.minusSeconds(1);

        // Month
        LocalDate firstOfMonth     = today.withDayOfMonth(1);
        LocalDate firstOfLastMonth = firstOfMonth.minusMonths(1);
        Instant monthStart     = firstOfMonth.atStartOfDay(VN).toInstant();
        Instant lastMonthStart = firstOfLastMonth.atStartOfDay(VN).toInstant();
        Instant lastMonthEnd   = monthStart.minusSeconds(1);

        // Fire all calls in parallel
        CompletableFuture<RevenueDto> todayRevF     = supplyAsync(() -> paymentClient.getRevenue(todayStart, now));
        CompletableFuture<RevenueDto> yestRevF      = supplyAsync(() -> paymentClient.getRevenue(yesterdayStart, yesterdayEnd));
        CompletableFuture<RevenueDto> weekRevF      = supplyAsync(() -> paymentClient.getRevenue(weekStart, now));
        CompletableFuture<RevenueDto> lastWeekRevF  = supplyAsync(() -> paymentClient.getRevenue(lastWeekStart, lastWeekEnd));
        CompletableFuture<RevenueDto> monthRevF     = supplyAsync(() -> paymentClient.getRevenue(monthStart, now));
        CompletableFuture<RevenueDto> lastMonthRevF = supplyAsync(() -> paymentClient.getRevenue(lastMonthStart, lastMonthEnd));
        CompletableFuture<OrderStatsDto>   orderF   = supplyAsync(() -> orderClient.getOrderStats());
        CompletableFuture<BookingStatsDto> bookingF = supplyAsync(() -> orderClient.getBookingStats());
        CompletableFuture<List<IngredientDto>> invF = supplyAsync(() -> inventoryClient.getLowStock());
        CompletableFuture<UserStatsDto>    userF    = supplyAsync(() -> userClient.getUserStats());

        // Revenue time-series (30 ngày, 12 tuần, 12 tháng, 5 năm)
        CompletableFuture<List<RevenuePeriodDto>> dailyF   = supplyAsync(() -> paymentClient.getRevenueSeries("DAY",   30));
        CompletableFuture<List<RevenuePeriodDto>> weeklyF  = supplyAsync(() -> paymentClient.getRevenueSeries("WEEK",  12));
        CompletableFuture<List<RevenuePeriodDto>> monthlyF = supplyAsync(() -> paymentClient.getRevenueSeries("MONTH", 12));
        CompletableFuture<List<RevenuePeriodDto>> yearlyF  = supplyAsync(() -> paymentClient.getRevenueSeries("YEAR",   5));

        try {
            CompletableFuture.allOf(todayRevF, yestRevF, weekRevF, lastWeekRevF,
                    monthRevF, lastMonthRevF, orderF, bookingF, invF, userF,
                    dailyF, weeklyF, monthlyF, yearlyF).orTimeout(10, TimeUnit.SECONDS).join();
        } catch (Exception e) {
            log.warn("[Dashboard] Timeout or error waiting for downstream services: {}", e.getMessage());
        }

        RevenueDto todayRev    = todayRevF.getNow(null);
        RevenueDto yestRev     = yestRevF.getNow(null);
        RevenueDto weekRev     = weekRevF.getNow(null);
        RevenueDto lastWeekRev = lastWeekRevF.getNow(null);
        RevenueDto monthRev    = monthRevF.getNow(null);
        RevenueDto lastMonthRev = lastMonthRevF.getNow(null);
        OrderStatsDto   orderStats   = orderF.getNow(null);
        BookingStatsDto bookingStats = bookingF.getNow(null);
        List<IngredientDto> lowStock = invF.getNow(Collections.emptyList());
        UserStatsDto userStats = userF.getNow(null);

        List<RevenuePeriodDto> dailySeries   = dailyF.getNow(Collections.emptyList());
        List<RevenuePeriodDto> weeklySeries  = weeklyF.getNow(Collections.emptyList());
        List<RevenuePeriodDto> monthlySeries = monthlyF.getNow(Collections.emptyList());
        List<RevenuePeriodDto> yearlySeries  = yearlyF.getNow(Collections.emptyList());

        double todayTotal    = revenue(todayRev);
        double yestTotal     = revenue(yestRev);
        double weekTotal     = revenue(weekRev);
        double lastWeekTotal = revenue(lastWeekRev);
        double monthTotal    = revenue(monthRev);
        double lastMonthTotal = revenue(lastMonthRev);

        // Build revenue stats
        DashboardResponse.RevenueStats revenueStats = DashboardResponse.RevenueStats.builder()
                .today(todayTotal)
                .yesterday(yestTotal)
                .todayChangePercent(changePercent(todayTotal, yestTotal))
                .thisWeek(weekTotal)
                .lastWeek(lastWeekTotal)
                .weekChangePercent(changePercent(weekTotal, lastWeekTotal))
                .thisMonth(monthTotal)
                .lastMonth(lastMonthTotal)
                .monthChangePercent(changePercent(monthTotal, lastMonthTotal))
                .todayTransactions(todayRev != null ? todayRev.getTotalTransactions() : 0L)
                .todayByMethod(todayRev != null ? todayRev.getRevenueByMethod() : Map.of())
                .dailySeries(toRevenuePeriods(dailySeries))
                .weeklySeries(toRevenuePeriods(weeklySeries))
                .monthlySeries(toRevenuePeriods(monthlySeries))
                .yearlySeries(toRevenuePeriods(yearlySeries))
                .build();

        // Build order stats
        DashboardResponse.OrderStats orderResult = orderStats == null
                ? DashboardResponse.OrderStats.builder().build()
                : DashboardResponse.OrderStats.builder()
                        .open(orderStats.getOpen())
                        .paid(orderStats.getPaid())
                        .cancelled(orderStats.getCancelled())
                        .occupiedTables(orderStats.getOccupiedTables())
                        .topProducts(orderStats.getTopProducts() == null ? List.of()
                                : orderStats.getTopProducts().stream()
                                        .map(p -> DashboardResponse.TopProduct.builder()
                                                .productName(p.getProductName())
                                                .quantity(p.getQuantity() != null ? p.getQuantity() : 0L)
                                                .build())
                                        .toList())
                        .build();

        // Build booking stats
        DashboardResponse.BookingStats bookingResult = bookingStats == null
                ? DashboardResponse.BookingStats.builder().build()
                : DashboardResponse.BookingStats.builder()
                        .pendingPayment(bookingStats.getPendingPayment())
                        .confirmedToday(bookingStats.getConfirmedToday())
                        .upcomingIn2Hours(bookingStats.getUpcomingIn2Hours())
                        .build();

        // Build inventory stats
        List<DashboardResponse.InventoryAlertStats.LowStockItem> lowStockList = lowStock == null ? List.of()
                : lowStock.stream().limit(6).map(i -> DashboardResponse.InventoryAlertStats.LowStockItem.builder()
                        .name(i.getName())
                        .unit(i.getBaseUnit())
                        .currentQty(i.getCurrentQty())
                        .minThreshold(i.getMinThreshold())
                        .build())
                        .toList();
        DashboardResponse.InventoryAlertStats inventoryResult = DashboardResponse.InventoryAlertStats.builder()
                .lowStockCount(lowStock == null ? 0 : lowStock.size())
                .lowStockItems(lowStockList)
                .build();

        // Build user stats
        DashboardResponse.UserStats userResult = userStats == null
                ? DashboardResponse.UserStats.builder().build()
                : DashboardResponse.UserStats.builder()
                        .activeAdmin(userStats.getActiveAdmin())
                        .activeEmployee(userStats.getActiveEmployee())
                        .totalActive(userStats.getTotalActive())
                        .build();

        return DashboardResponse.builder()
                .revenue(revenueStats)
                .orders(orderResult)
                .bookings(bookingResult)
                .inventory(inventoryResult)
                .users(userResult)
                .build();
    }

    private <T> CompletableFuture<T> supplyAsync(java.util.function.Supplier<T> supplier) {
        // Capture RequestAttributes từ main thread để forward JWT sang worker threads
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        return CompletableFuture.supplyAsync(() -> {
            try {
                if (attrs != null) RequestContextHolder.setRequestAttributes(attrs);
                return supplier.get();
            } catch (Exception e) {
                log.warn("[Dashboard] Feign call failed: {}", e.getMessage());
                return null;
            } finally {
                RequestContextHolder.resetRequestAttributes();
            }
        });
    }

    private double revenue(RevenueDto dto) {
        return dto != null && dto.getTotalRevenue() != null ? dto.getTotalRevenue() : 0.0;
    }

    private double changePercent(double current, double previous) {
        if (previous == 0) return current > 0 ? 100.0 : 0.0;
        return Math.round((current - previous) / previous * 1000.0) / 10.0;
    }

    private List<DashboardResponse.RevenuePeriod> toRevenuePeriods(List<RevenuePeriodDto> dtos) {
        if (dtos == null) return List.of();
        return dtos.stream()
                .map(dto -> DashboardResponse.RevenuePeriod.builder()
                        .period(dto.getPeriod())
                        .revenue(dto.getRevenue())
                        .transactions(dto.getTransactions())
                        .byMethod(dto.getByMethod() != null ? dto.getByMethod() : Map.of())
                        .build())
                .toList();
    }
}
