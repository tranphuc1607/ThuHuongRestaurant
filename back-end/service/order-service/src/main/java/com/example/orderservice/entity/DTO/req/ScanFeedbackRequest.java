package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/**
 * Phản hồi từ màn hình duyệt kết quả quét: nhân viên đã chốt dòng chữ viết tay này là món nào.
 * Dùng để học dần cách viết tắt riêng của nhà hàng.
 */
@Data
public class ScanFeedbackRequest {

    @NotEmpty(message = "Cần ít nhất 1 mục phản hồi")
    private List<Item> items;

    @Data
    public static class Item {
        /** Chữ gốc đọc được từ hoá đơn. */
        private String rawText;
        /** Món mà nhân viên đã xác nhận. */
        private UUID productId;
    }
}
