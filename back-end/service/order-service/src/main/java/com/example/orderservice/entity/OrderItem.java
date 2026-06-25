package com.example.orderservice.entity;

import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "order_items", indexes = {
        @Index(name = "idx_item_order", columnList = "order_id"),
        @Index(name = "idx_item_product", columnList = "product_id"),
        @Index(name = "idx_item_pending_deduction", columnList = "inventory_deducted, deduct_scheduled_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    private Long version;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "product_price", nullable = false)
    private Double productPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "sale_unit", nullable = false, length = 20)
    private String saleUnit;

    @Column(name = "item_total", nullable = false)
    private Double itemTotal;

    @Column(name = "from_booking", nullable = false)
    @Builder.Default
    private boolean fromBooking = false;

    @Column(name = "inventory_deducted", nullable = false)
    @Builder.Default
    private boolean inventoryDeducted = false;

    @Column(name = "deduct_scheduled_at")
    private Instant deductScheduledAt;
}
