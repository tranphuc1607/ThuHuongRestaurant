package com.example.orderservice.entity;

import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

/**
 * Cách viết tay thực tế mà nhân viên đã xác nhận ứng với món nào.
 *
 * <p>Học dần từ chính hoá đơn của nhà hàng: mỗi lần nhân viên xác nhận hoặc sửa một dòng quét,
 * cặp (chữ viết tay đã chuẩn hoá → sản phẩm) được ghi lại. Những bí danh này sau đó vừa được
 * đưa vào prompt, vừa cộng điểm trong bộ so khớp — nên hệ thống ngày càng đọc đúng lối viết tắt
 * riêng của nhân viên ở đây, thứ mà không model nào biết trước được.
 */
@Entity
@Table(name = "receipt_scan_aliases", indexes = {
        @Index(name = "idx_alias_text", columnList = "normalized_text"),
        @Index(name = "idx_alias_product", columnList = "product_id")
}, uniqueConstraints = {
        @UniqueConstraint(name = "uk_alias_text_product", columnNames = {"normalized_text", "product_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReceiptScanAlias extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** Chữ viết tay đã chuẩn hoá bằng {@code VietnameseTextMatcher.normalize}. */
    @Column(name = "normalized_text", nullable = false, length = 200)
    private String normalizedText;

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    /** Số lần nhân viên xác nhận cặp này — dùng để xếp hạng và lọc nhiễu. */
    @Column(name = "hit_count", nullable = false)
    @Builder.Default
    private Integer hitCount = 1;
}
