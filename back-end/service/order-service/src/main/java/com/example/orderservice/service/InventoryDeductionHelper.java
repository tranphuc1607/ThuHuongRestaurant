package com.example.orderservice.service;

import com.example.orderservice.client.InventoryServiceClient;
import com.example.orderservice.client.dto.OrderDeductionPayload;
import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.enums.OrderStatus;
import com.example.orderservice.repository.OrderItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class InventoryDeductionHelper {

    private final OrderItemRepository orderItemRepository;
    private final InventoryServiceClient inventoryServiceClient;

    // REQUIRES_NEW: mỗi item là 1 transaction độc lập
    // Nếu 1 item fail → chỉ rollback item đó, không ảnh hưởng items đã deduct trước
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void deductSingleItem(UUID itemId) {
        // Pessimistic lock trên từng item — ngăn race condition với removeItem/cancelOrder
        // Dùng findByIdForUpdate thay vì findById để tránh deadlock với outer scheduler
        OrderItem item = orderItemRepository.findByIdForUpdate(itemId).orElse(null);
        if (item == null) {
            log.warn("[Scheduler] OrderItem id={} không còn tồn tại, bỏ qua", itemId);
            return;
        }
        if (item.isInventoryDeducted()) {
            log.warn("[Scheduler] OrderItem id={} đã được deduct rồi, bỏ qua", itemId);
            return;
        }
        if (item.getOrder().getStatus() != OrderStatus.OPEN) {
            log.info("[Scheduler] Order {} không còn OPEN ({}), bỏ qua deduct item id={}",
                    item.getOrder().getId(), item.getOrder().getStatus(), itemId);
            return;
        }

        OrderDeductionPayload payload = OrderDeductionPayload.builder()
                .orderId(item.getOrder().getId().toString())
                .items(List.of(OrderDeductionPayload.OrderItem.builder()
                        .productId(item.getProductId())
                        .quantity(item.getQuantity())
                        .saleUnit(item.getSaleUnit())
                        .build()))
                .build();

        inventoryServiceClient.deductForOrder(payload);
        item.setInventoryDeducted(true);
        orderItemRepository.save(item);
        log.info("[Scheduler] Đã trừ kho orderItem id={}, productId={}, qty={}",
                item.getId(), item.getProductId(), item.getQuantity());
    }
}
