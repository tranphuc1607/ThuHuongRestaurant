package com.example.hrservice.entity.DTO.req;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@Data
public class AssignShiftRequest {

    @NotNull(message = "Nhân viên không được để trống")
    private Long employeeId;

    @NotNull(message = "Ca làm việc không được để trống")
    private Long shiftId;

    @NotEmpty(message = "Vui lòng chọn ít nhất một ngày trong tuần")
    private List<DayOfWeek> daysOfWeek;

    @NotNull(message = "Ngày bắt đầu áp dụng không được để trống")
    private LocalDate effectiveFrom;

    // null = vô thời hạn
    private LocalDate effectiveTo;
}
