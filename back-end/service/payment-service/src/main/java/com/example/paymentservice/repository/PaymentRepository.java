package com.example.paymentservice.repository;

import com.example.paymentservice.entity.Payment;
import com.example.paymentservice.entity.enums.PaymentMethod;
import com.example.paymentservice.entity.enums.PaymentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderIdAndStatusIn(Long orderId, List<PaymentStatus> statuses);

    Optional<Payment> findByOrderId(Long orderId);

    boolean existsByReferenceCode(String referenceCode);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    Page<Payment> findByPaymentMethod(PaymentMethod method, Pageable pageable);

    Page<Payment> findByStatusAndPaymentMethod(PaymentStatus status, PaymentMethod method, Pageable pageable);

    @Query("SELECT p.paymentMethod, SUM(p.amount), COUNT(p) FROM Payment p " +
           "WHERE p.status = :status AND p.paidAt BETWEEN :from AND :to " +
           "GROUP BY p.paymentMethod")
    List<Object[]> findRevenueGroupedByMethod(
            @Param("status") PaymentStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to);
}
