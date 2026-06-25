package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.enums.TableStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TableResponse {

    private Long id;
    private Integer tableNumber;
    private String name;
    private String qrToken;
    private TableStatus status;
    private String note;

    public static TableResponse from(DiningTable table) {
        return TableResponse.builder()
                .id(table.getId())
                .tableNumber(table.getTableNumber())
                .name(table.getName())
                .qrToken(table.getQrToken())
                .status(table.getStatus())
                .note(table.getNote())
                .build();
    }
}
