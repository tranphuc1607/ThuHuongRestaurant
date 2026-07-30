package com.example.hrservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "shift_assignments", indexes = {
        @Index(name = "idx_assignment_employee", columnList = "employee_id"),
        @Index(name = "idx_assignment_day", columnList = "employee_id,day_of_week")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ShiftAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id", nullable = false)
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 15)
    private DayOfWeek dayOfWeek;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    // null = vô thời hạn
    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Builder.Default
    private boolean active = true;
}
