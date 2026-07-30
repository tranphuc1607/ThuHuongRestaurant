package com.example.orderservice.entity;

import com.example.orderservice.entity.enums.BookingPaymentMethod;
import com.example.orderservice.entity.enums.BookingStatus;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "bookings", indexes = {
        @Index(name = "idx_booking_code", columnList = "booking_code", unique = true),
        @Index(name = "idx_booking_status", columnList = "status"),
        @Index(name = "idx_booking_scheduled", columnList = "scheduled_time"),
        @Index(name = "idx_booking_table_time", columnList = "table_id, scheduled_time")
})
@SQLDelete(sql = "UPDATE bookings SET is_deleted = true WHERE id = ?")
@SQLRestriction("is_deleted = false")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Booking extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "booking_code", nullable = false, unique = true, length = 20)
    private String bookingCode;

    @Column(name = "customer_name", nullable = false, length = 100)
    private String customerName;

    @Column(name = "customer_phone", nullable = false, length = 20)
    private String customerPhone;

    @Column(name = "customer_bank_account", length = 50)
    private String customerBankAccount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private DiningTable diningTable;

    @Column(name = "scheduled_time", nullable = false)
    private Instant scheduledTime;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @BatchSize(size = 20)
    @Builder.Default
    private List<BookingItem> items = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private BookingStatus status = BookingStatus.PENDING_PAYMENT;

    @Column(name = "total_amount", nullable = false)
    @Builder.Default
    private Double totalAmount = 0.0;

    // Số tiền thực sự đã nhận khi xác nhận (BANK_TRANSFER = totalAmount lúc confirm, CASH = 0)
    // Không thay đổi khi admin xóa/giảm món sau khi confirm → dùng để tính hoàn tiền
    @Column(name = "paid_amount")
    @Builder.Default
    private Double paidAmount = 0.0;

    @Version
    private Long version;

    @Column(name = "cancelled_by", length = 100)
    private String cancelledBy;

    @Column(name = "cancel_reason", length = 500)
    private String cancelReason;

    @Column(length = 500)
    private String note;

    @Column(name = "stock_warning", length = 1000)
    private String stockWarning;

    @Builder.Default
    private boolean isDeleted = false;

    @Column(name = "reminder_sent")
    @Builder.Default
    private boolean reminderSent = false;

    @Column(name = "guest_count")
    private Integer guestCount;

    // null = chưa xác nhận; BANK_TRANSFER = chuyển khoản; CASH = tiền mặt khi đến ăn
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", length = 20)
    private BookingPaymentMethod paymentMethod;

    // null = khách vãng lai; có giá trị = user đã đăng nhập khi đặt bàn
    @Column(name = "owner_username", length = 100)
    private String ownerUsername;
}
