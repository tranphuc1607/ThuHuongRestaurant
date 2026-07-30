package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.enums.TableStatus;
import com.example.orderservice.entity.enums.TableZone;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class TableResponse {

    private UUID id;
    private Integer tableNumber;
    private String name;
    private String qrToken;
    private TableStatus status;
    private TableZone zone;
    private String note;

    public static TableResponse from(DiningTable table) {
        return TableResponse.builder()
                .id(table.getId())
                .tableNumber(table.getTableNumber())
                .name(table.getName())
                .qrToken(table.getQrToken())
                .status(table.getStatus())
                .zone(table.getZone() != null ? table.getZone() : TableZone.INDOOR_FLOOR_1)
                .note(table.getNote())
                .build();
    }
}
