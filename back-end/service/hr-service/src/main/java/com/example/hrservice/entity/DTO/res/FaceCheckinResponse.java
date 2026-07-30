package com.example.hrservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class FaceCheckinResponse {
    private String action;         // "CHECK_IN" hoặc "CHECK_OUT"
    private String employeeName;
    private AttendanceResponse attendance;
}
