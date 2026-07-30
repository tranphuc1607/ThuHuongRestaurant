package com.example.orderservice.entity;

import com.example.orderservice.entity.enums.OrderStatus;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_order_table", columnList = "table_id"),
        @Index(name = "idx_order_status", columnList = "status")
})
@SQLDelete(sql = "UPDATE orders SET is_deleted = true WHERE id = ?")
@SQLRestriction("is_deleted = false")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Order extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id", nullable = true)
    private DiningTable diningTable;

    // @OrderBy: không có thì thứ tự do DB quyết định, mỗi lần đọc có thể khác nhau. Nhân viên đối
    // chiếu đơn với tờ hoá đơn giấy (nhất là các đợt bia) nên cần đúng thứ tự đã nhập.
    // created_at là datetime(6) nên đủ chính xác để không bị trùng.
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @BatchSize(size = 20)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<OrderItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, fetch = FetchType.LAZY, orphanRemoval = true)
    @BatchSize(size = 20)
    @OrderBy("createdAt ASC")
    @Builder.Default
    private List<OrderSurcharge> surcharges = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private OrderStatus status = OrderStatus.OPEN;

    @Column(name = "total_amount", nullable = false)
    @Builder.Default
    private Double totalAmount = 0.0;

    // Số tiền khách đã trả trước qua booking (bank transfer)
    @Column(name = "prepaid_amount", nullable = false)
    @Builder.Default
    private Double prepaidAmount = 0.0;

    @Version
    private Long version;

    @Column(name = "confirmed_by", length = 100)
    private String confirmedBy;

    @Column(name = "paid_by", length = 100)
    private String paidBy;

    @Column(length = 500)
    private String note;

    @Column(name = "guest_count")
    private Integer guestCount;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Builder.Default
    private boolean isDeleted = false;
}
