package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.enums.OrderStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;


@Data
@Builder
public class OrderResponse {

    private UUID id;
    private UUID tableId;
    private String tableName;
    private Integer tableNumber;
    private String tableQrToken;
    private OrderStatus status;
    private Double totalAmount;
    private Double prepaidAmount;
    private String createdBy;
    private String confirmedBy;
    private String paidBy;
    private String note;
    private Integer guestCount;
    private String cancelReason;
    private Instant createdAt;
    private List<OrderItemResponse> items;
    private List<OrderSurchargeResponse> surcharges;

    public static OrderResponse from(Order order) {
        var table = order.getDiningTable();
        return OrderResponse.builder()
                .id(order.getId())
                .tableId(table != null ? table.getId() : null)
                .tableName(table != null ? table.getName() : null)
                .tableNumber(table != null ? table.getTableNumber() : null)
                .tableQrToken(table != null ? table.getQrToken() : null)
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .prepaidAmount(order.getPrepaidAmount())
                .createdBy(order.getCreatedBy())
                .confirmedBy(order.getConfirmedBy())
                .paidBy(order.getPaidBy())
                .note(order.getNote())
                .guestCount(order.getGuestCount())
                .cancelReason(order.getCancelReason())
                .createdAt(order.getCreatedAt())
                .items(order.getItems().stream()
                        .map(OrderItemResponse::from)
                        .collect(Collectors.toList()))
                .surcharges(order.getSurcharges().stream()
                        .map(OrderSurchargeResponse::from)
                        .collect(Collectors.toList()))
                .build();
    }
}
