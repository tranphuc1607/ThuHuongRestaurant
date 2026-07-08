package com.example.orderservice.entity;

import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "order_surcharges", indexes = {
        @Index(name = "idx_surcharge_order", columnList = "order_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderSurcharge extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "unit_price", nullable = false)
    private Double unitPrice;

    @Column(nullable = false)
    private Integer quantity;

    // = unitPrice * quantity
    @Column(nullable = false)
    private Double amount;

    @Column(length = 500)
    private String reason;
}
