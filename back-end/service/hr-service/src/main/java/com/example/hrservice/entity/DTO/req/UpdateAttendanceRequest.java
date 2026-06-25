package com.example.hrservice.entity.DTO.req;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateAttendanceRequest {

    // "checkInTime" hoặc "checkOutTime"
    @NotBlank(message = "Trường cần sửa không được để trống")
    private String field;

    // Định dạng ISO-8601, VD: "2026-06-25T01:05:00Z"
    @NotBlank(message = "Giá trị mới không được để trống")
    private String newTime;

    @NotBlank(message = "Lý do chỉnh sửa không được để trống")
    private String reason;
}
