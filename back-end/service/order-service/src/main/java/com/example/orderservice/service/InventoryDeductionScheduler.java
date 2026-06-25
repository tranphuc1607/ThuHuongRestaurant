package com.example.orderservice.service;

import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class InventoryDeductionScheduler {

    private final OrderItemRepository orderItemRepository;
    private final InventoryDeductionHelper deductionHelper;

    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    @Transactional
    public void deductPendingItems() {
        try {
            List<OrderItem> pending = orderItemRepository.findPendingDeductionsForUpdate(Instant.now(), OrderStatus.OPEN);
            if (pending.isEmpty()) return;

            log.info("[Scheduler] Tìm thấy {} item cần trừ kho", pending.size());
            for (OrderItem item : pending) {
                try {
                    deductionHelper.deductSingleItem(item.getId());
                } catch (Exception e) {
                    log.error("[Scheduler] Lỗi trừ kho orderItem id={}: {}", item.getId(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[Scheduler] Không thể query pending deductions (DB down?): {}", e.getMessage());
        }
    }
}
