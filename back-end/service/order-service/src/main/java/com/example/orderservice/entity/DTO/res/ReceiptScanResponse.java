package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Kết quả quét một hoá đơn (có thể gồm nhiều trang). */
@Data
@Builder
public class ReceiptScanResponse {

    @Builder.Default
    private List<ScannedItemResponse> items = List.of();

    /** Ô "Bàn số" đọc được, ví dụ "5" — để app chọn sẵn bàn. Null nếu bỏ trống. */
    private String tableLabel;

    /**
     * Hàng "Bia" trên mẫu hoá đơn: mỗi ô là MỘT đợt khách gọi, giữ nguyên thứ tự đã ghi.
     * Ví dụ {@code [4, 6, 2]} = ba đợt lần lượt 4, 6 và 2 cốc — KHÔNG cộng thành 12.
     */
    @Builder.Default
    private List<Integer> beerRounds = List.of();

    /** Sản phẩm bia cốc đã khớp trong thực đơn — null nếu thực đơn không có món này. */
    private UUID beerProductId;
    private String beerProductName;
    private Double beerUnitPrice;

    /** Dòng "TỔNG CỘNG" đọc được. */
    private Double grandTotal;
    /** Tổng các "Thành tiền" cộng lại (đã gồm tiền bia) — dùng để đối chiếu với grandTotal. */
    private Double computedTotal;

    /** Cảnh báo cấp hoá đơn, ví dụ tổng cộng lệch. */
    @Builder.Default
    private List<String> warnings = List.of();

    /** Model AI đã dùng — để đối chiếu khi so sánh chất lượng giữa các model. */
    private String model;
}
