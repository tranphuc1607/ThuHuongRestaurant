package com.example.orderservice.repository;

import com.example.orderservice.entity.ReceiptScanAlias;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReceiptScanAliasRepository extends JpaRepository<ReceiptScanAlias, UUID> {

    Optional<ReceiptScanAlias> findByNormalizedTextAndProductId(String normalizedText, UUID productId);

    List<ReceiptScanAlias> findByNormalizedText(String normalizedText);

    /** Bí danh được dùng nhiều nhất — chỉ nạp một số hữu hạn vào prompt để không phình context. */
    @Query("SELECT a FROM ReceiptScanAlias a ORDER BY a.hitCount DESC")
    List<ReceiptScanAlias> findTopUsed(Pageable pageable);
}
