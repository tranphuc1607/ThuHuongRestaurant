package com.example.hrservice.entity.DTO.req;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class SaveFaceDescriptorRequest {

    @NotNull(message = "Vui lòng cung cấp dữ liệu khuôn mặt")
    private List<Double> descriptor; // 128 floats từ face-api.js FaceRecognitionNet
}
