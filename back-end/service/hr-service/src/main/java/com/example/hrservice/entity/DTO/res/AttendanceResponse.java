package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.Attendance;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Data
@Builder
public class AttendanceResponse {

    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private UUID shiftId;
    private String shiftName;
    private LocalTime shiftStartTime;
    private Instant checkInTime;
    private Instant checkOutTime;
    private LocalDate workDate;
    private Double totalHours;
    private int lateMinutes;
    private boolean punished;
    private Double punishmentAmount;
    private String punishmentReason;

    public static AttendanceResponse from(Attendance a) {
        return AttendanceResponse.builder()
                .id(a.getId())
                .employeeId(a.getEmployee().getId())
                .employeeName(a.getEmployee().getName())
                .shiftId(a.getShift() != null ? a.getShift().getId() : null)
                .shiftName(a.getShift() != null ? a.getShift().getName() : null)
                .shiftStartTime(a.getShift() != null ? a.getShift().getStartTime() : null)
                .checkInTime(a.getCheckInTime())
                .checkOutTime(a.getCheckOutTime())
                .workDate(a.getWorkDate())
                .totalHours(a.getTotalHours())
                .lateMinutes(a.getLateMinutes())
                .punished(a.isPunished())
                .punishmentAmount(a.getPunishmentAmount())
                .punishmentReason(a.getPunishmentReason())
                .build();
    }
}
