package com.example.hrservice.entity;

import com.example.hrservice.entity.enums.EmployeeType;
import com.example.hrservice.entity.enums.SalaryType;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;

import java.util.UUID;

@Entity
@Table(name = "employees", indexes = {
        @Index(name = "idx_employee_telegram", columnList = "telegram_id"),
        @Index(name = "idx_employee_phone", columnList = "phone")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class Employee extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "telegram_id", unique = true)
    private Long telegramId;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private EmployeeType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "salary_type", nullable = false, length = 20)
    private SalaryType salaryType;

    // Lương tháng (FIXED) hoặc lương giờ (HOURLY) — đơn vị: VND
    @Column(name = "base_value", nullable = false)
    private Double baseValue;

    // Số ngày làm chuẩn trong tháng (chỉ dùng cho FIXED salary)
    @Column(name = "target_days")
    private Integer targetDays;

    // Liên kết với User trong user-service (nullable — nhân viên tạo trực tiếp không có userId)
    @Column(name = "user_id", unique = true, columnDefinition = "BINARY(16)")
    private UUID userId;

    // JSON array of 128 floats from face-api.js FaceRecognitionNet
    @Column(name = "face_descriptor", columnDefinition = "TEXT")
    private String faceDescriptor;

    @Builder.Default
    private boolean active = true;
}
