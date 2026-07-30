package com.example.hrservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class FaceDescriptorEntry {
    private UUID employeeId;
    private String name;
    private List<Double> descriptor; // 128 floats
}
