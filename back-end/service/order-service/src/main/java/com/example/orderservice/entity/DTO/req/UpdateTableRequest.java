package com.example.orderservice.entity.DTO.req;

import com.example.orderservice.entity.enums.TableZone;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateTableRequest {

    @Size(min = 1, max = 100, message = "Tên bàn phải từ 1 đến 100 ký tự")
    private String name;

    private TableZone zone;

    @Size(max = 500, message = "Ghi chú không được vượt quá 500 ký tự")
    private String note;
}
