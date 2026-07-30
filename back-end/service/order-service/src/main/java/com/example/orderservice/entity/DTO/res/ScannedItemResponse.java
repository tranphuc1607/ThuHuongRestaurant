package com.example.orderservice.entity.DTO.res;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

/** Một dòng đọc được từ bảng trên hoá đơn viết tay. */
@Data
@Builder
public class ScannedItemResponse {

    /** Cột STT trên mẫu hoá đơn (1..10). Null nếu không đọc được. */
    private Integer rowNumber;

    private UUID productId;
    private String productName;
    private Integer quantity;

    /** Luôn lấy từ DB của sản phẩm đã khớp — không dùng giá trị AI đoán. */
    private String saleUnit;

    /** Chữ gốc ở cột "Tên hàng". */
    private String rawText;
    /** Chữ gốc ở cột "ĐVT" — chỉ để tham chiếu, không dùng để tạo món. */
    private String rawUnit;

    /** Cột "Đơn giá" đọc được (đồng). */
    private Double unitPrice;
    /** Cột "Thành tiền" đọc được (đồng). */
    private Double lineTotal;
    /** Giá trong DB của sản phẩm đã khớp — để đối chiếu với unitPrice. */
    private Double catalogPrice;

    /** high | low | none */
    private String confidence;

    /** Gợi ý thay thế, xếp theo điểm giảm dần. Rỗng khi đã chắc chắn. */
    @Builder.Default
    private List<MatchCandidate> candidates = List.of();

    /** Cảnh báo dành cho nhân viên, ví dụ lệch phép tính. */
    @Builder.Default
    private List<String> warnings = List.of();
}
