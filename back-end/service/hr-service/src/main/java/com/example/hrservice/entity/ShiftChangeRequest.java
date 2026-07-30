package com.example.hrservice.entity;

import com.example.hrservice.entity.enums.SwapStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "shift_change_requests", indexes = {
        @Index(name = "idx_swap_employee_date", columnList = "employee_id,request_date"),
        @Index(name = "idx_swap_status", columnList = "status")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftChangeRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_shift_id", nullable = false)
    private Shift originalShift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_shift_id", nullable = false)
    private Shift requestedShift;

    @Column(name = "request_date", nullable = false)
    private LocalDate requestDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private SwapStatus status = SwapStatus.PENDING;

    // Telegram ID của admin đã xử lý
    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    // Dùng để edit lại message thông báo cho admin sau khi xử lý
    @Column(name = "admin_chat_id")
    private Long adminChatId;

    @Column(name = "admin_message_id")
    private Integer adminMessageId;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
