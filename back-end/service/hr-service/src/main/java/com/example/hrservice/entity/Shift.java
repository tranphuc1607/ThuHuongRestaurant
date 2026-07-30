package com.example.hrservice.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "shifts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "duration_hours", nullable = false)
    private Double durationHours;

    // true khi end_time < start_time (ca xuyên đêm VD: 22:00–06:00)
    @Column(name = "is_overnight", nullable = false)
    @Builder.Default
    private boolean overnight = false;

    @Builder.Default
    private boolean active = true;
}
