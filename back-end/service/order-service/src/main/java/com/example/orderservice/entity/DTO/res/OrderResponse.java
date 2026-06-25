package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.enums.OrderStatus;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class OrderResponse {

    private Long id;
    private Long tableId;
    private String tableName;
    private Integer tableNumber;
    private OrderStatus status;
    private Double totalAmount;
    private Double prepaidAmount;
    private String createdBy;
    private String confirmedBy;
    private String paidBy;
    private String note;
    private List<OrderItemResponse> items;

    public static OrderResponse from(Order order) {
        return OrderResponse.builder()
                .id(order.getId())
                .tableId(order.getDiningTable().getId())
                .tableName(order.getDiningTable().getName())
                .tableNumber(order.getDiningTable().getTableNumber())
                .status(order.getStatus())
                .totalAmount(order.getTotalAmount())
                .prepaidAmount(order.getPrepaidAmount())
                .createdBy(order.getCreatedBy())
                .confirmedBy(order.getConfirmedBy())
                .paidBy(order.getPaidBy())
                .note(order.getNote())
                .items(order.getItems().stream()
                        .map(OrderItemResponse::from)
                        .collect(Collectors.toList()))
                .build();
    }
}
