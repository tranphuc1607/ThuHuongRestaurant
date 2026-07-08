package com.example.orderservice.repository;

import com.example.orderservice.entity.OrderItem;
import com.example.orderservice.entity.enums.OrderStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    // Đọc danh sách pending — KHÔNG lock, outer scheduler không giữ tx
    @Query("SELECT i FROM OrderItem i JOIN FETCH i.order o WHERE i.inventoryDeducted = false " +
           "AND i.deductScheduledAt IS NOT NULL AND i.deductScheduledAt <= :now " +
           "AND o.status = :status")
    List<OrderItem> findPendingDeductions(@Param("now") Instant now, @Param("status") OrderStatus status);

    // Lock từng item riêng lẻ bên trong REQUIRES_NEW transaction của helper
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM OrderItem i WHERE i.id = :id")
    java.util.Optional<OrderItem> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT i.productName, SUM(i.quantity) FROM OrderItem i JOIN i.order o " +
           "WHERE o.createdAt BETWEEN :from AND :to AND o.status != 'CANCELLED' " +
           "GROUP BY i.productId, i.productName ORDER BY SUM(i.quantity) DESC")
    List<Object[]> findTopProducts(@Param("from") Instant from, @Param("to") Instant to, Pageable pageable);
}
