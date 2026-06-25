package com.example.orderservice.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "booking_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id", nullable = false)
    private Booking booking;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "product_name", nullable = false, length = 200)
    private String productName;

    @Column(name = "product_price", nullable = false)
    private Double productPrice;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "sale_unit", nullable = false, length = 50)
    private String saleUnit;

    @Column(name = "item_total", nullable = false)
    private Double itemTotal;
}
