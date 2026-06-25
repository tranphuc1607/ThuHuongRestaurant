package com.example.orderservice.entity;

import com.example.orderservice.entity.enums.TableStatus;
import com.example.restaurant_common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

@Entity
@Table(name = "dining_tables", indexes = {
        @Index(name = "idx_table_number", columnList = "table_number", unique = true),
        @Index(name = "idx_qr_token", columnList = "qr_token", unique = true)
})
@SQLDelete(sql = "UPDATE dining_tables SET is_deleted = true WHERE id = ?")
@SQLRestriction("is_deleted = false")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@DynamicUpdate
public class DiningTable extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "table_number", nullable = false, unique = true)
    private Integer tableNumber;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "qr_token", nullable = false, unique = true, length = 36)
    private String qrToken;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TableStatus status = TableStatus.AVAILABLE;

    @Column(length = 500)
    private String note;

    @Builder.Default
    private boolean isDeleted = false;
}
