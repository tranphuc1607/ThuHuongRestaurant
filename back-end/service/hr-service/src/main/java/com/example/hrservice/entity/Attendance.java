package com.example.hrservice.entity;

import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "attendances", indexes = {
        @Index(name = "idx_attendance_employee_date", columnList = "employee_id,work_date"),
        @Index(name = "idx_attendance_work_date", columnList = "work_date")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Attendance extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = true)
    private Shift shift;

    @Column(name = "check_in_time", nullable = false)
    private Instant checkInTime;

    @Column(name = "check_out_time")
    private Instant checkOutTime;

    // Ngày làm tính theo múi giờ VN (UTC+7)
    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    // Tổng giờ làm, được tính khi check-out
    @Column(name = "total_hours")
    private Double totalHours;

    // Số phút đi trễ so với giờ bắt đầu ca
    @Column(name = "late_minutes", nullable = false)
    @Builder.Default
    private int lateMinutes = 0;

    @Column(name = "is_punished", nullable = false)
    @Builder.Default
    private boolean punished = false;

    @Column(name = "punishment_amount")
    private Double punishmentAmount;

    @Column(name = "punishment_reason", length = 500)
    private String punishmentReason;
}
