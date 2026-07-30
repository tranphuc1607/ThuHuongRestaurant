package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

/** Một ứng viên khớp cho dòng hoá đơn — dùng làm gợi ý khi độ tin cậy thấp. */
@Data
@Builder
public class MatchCandidate {
    private UUID productId;
    private String productName;
    private Double price;
    /** Điểm khớp tương đối, chỉ để xếp hạng — không phải xác suất. */
    private Integer score;
}
