package com.example.hrservice.entity.DTO.req;

import com.example.hrservice.entity.enums.EmployeeType;
import com.example.hrservice.entity.enums.SalaryType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateEmployeeRequest {

    @NotBlank(message = "Tên nhân viên không được để trống")
    private String name;

    private String phone;

    private Long telegramId;

    // Liên kết với userId trong user-service (tùy chọn, dùng khi tự động tạo từ role change)
    private UUID userId;

    @NotNull(message = "Loại nhân viên không được để trống")
    private EmployeeType type;

    @NotNull(message = "Loại lương không được để trống")
    private SalaryType salaryType;

    @NotNull(message = "Mức lương cơ bản không được để trống")
    @Positive(message = "Mức lương phải lớn hơn 0")
    private Double baseValue;

    // Bắt buộc nếu salaryType = FIXED
    private Integer targetDays;
}
