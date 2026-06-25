package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.Attendance;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
@Builder
public class AttendanceResponse {

    private Long id;
    private Long employeeId;
    private String employeeName;
    private Long shiftId;
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
                .shiftId(a.getShift().getId())
                .shiftName(a.getShift().getName())
                .shiftStartTime(a.getShift().getStartTime())
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
