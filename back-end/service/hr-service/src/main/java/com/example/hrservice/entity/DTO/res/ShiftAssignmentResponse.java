package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.ShiftAssignment;
import lombok.Builder;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class ShiftAssignmentResponse {

    private UUID id;
    private UUID employeeId;
    private String employeeName;
    private UUID shiftId;
    private String shiftName;
    private DayOfWeek dayOfWeek;
    private LocalDate effectiveFrom;
    private LocalDate effectiveTo;
    private boolean active;

    public static ShiftAssignmentResponse from(ShiftAssignment sa) {
        return ShiftAssignmentResponse.builder()
                .id(sa.getId())
                .employeeId(sa.getEmployee().getId())
                .employeeName(sa.getEmployee().getName())
                .shiftId(sa.getShift().getId())
                .shiftName(sa.getShift().getName())
                .dayOfWeek(sa.getDayOfWeek())
                .effectiveFrom(sa.getEffectiveFrom())
                .effectiveTo(sa.getEffectiveTo())
                .active(sa.isActive())
                .build();
    }
}
