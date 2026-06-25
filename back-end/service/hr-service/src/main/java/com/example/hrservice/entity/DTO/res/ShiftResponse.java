package com.example.hrservice.entity.DTO.res;

import com.example.hrservice.entity.Shift;
import lombok.Builder;
import lombok.Data;

import java.time.LocalTime;

@Data
@Builder
public class ShiftResponse {

    private Long id;
    private String name;
    private LocalTime startTime;
    private LocalTime endTime;
    private Double durationHours;
    private boolean overnight;
    private boolean active;

    public static ShiftResponse from(Shift s) {
        return ShiftResponse.builder()
                .id(s.getId())
                .name(s.getName())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .durationHours(s.getDurationHours())
                .overnight(s.isOvernight())
                .active(s.isActive())
                .build();
    }
}
