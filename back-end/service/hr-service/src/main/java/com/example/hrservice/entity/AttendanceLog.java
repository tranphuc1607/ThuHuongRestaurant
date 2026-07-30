package com.example.hrservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "attendance_logs", indexes = {
        @Index(name = "idx_log_attendance", columnList = "attendance_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attendance_id", nullable = false)
    private Attendance attendance;

    @Column(name = "edited_by", length = 100, nullable = false)
    private String editedBy;

    @Column(name = "field_changed", length = 50, nullable = false)
    private String fieldChanged;

    @Column(name = "old_value", length = 50)
    private String oldValue;

    @Column(name = "new_value", length = 50)
    private String newValue;

    @Column(length = 500)
    private String reason;

    @Column(name = "edited_at", nullable = false)
    @Builder.Default
    private Instant editedAt = Instant.now();
}
