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
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByOrderIdAndStatusIn(UUID orderId, List<PaymentStatus> statuses);

    // Exclude REFUND payments when checking for active billing payments
    @Query("SELECT p FROM Payment p WHERE p.orderId = :orderId AND p.paymentMethod != com.example.paymentservice.entity.enums.PaymentMethod.REFUND AND p.status IN :statuses AND p.isDeleted = false")
    Optional<Payment> findActiveNonRefundPayment(@Param("orderId") UUID orderId, @Param("statuses") List<PaymentStatus> statuses);

    Optional<Payment> findByOrderId(UUID orderId);

    List<Payment> findAllByOrderIdOrderByCreatedAtDesc(UUID orderId);

    boolean existsByReferenceCode(String referenceCode);

    Page<Payment> findByStatus(PaymentStatus status, Pageable pageable);

    Page<Payment> findByPaymentMethod(PaymentMethod method, Pageable pageable);

    Page<Payment> findByStatusAndPaymentMethod(PaymentStatus status, PaymentMethod method, Pageable pageable);

    Page<Payment> findByCreatedAtBetween(Instant from, Instant to, Pageable pageable);

    Page<Payment> findByStatusAndCreatedAtBetween(PaymentStatus status, Instant from, Instant to, Pageable pageable);

    Page<Payment> findByPaymentMethodAndCreatedAtBetween(PaymentMethod method, Instant from, Instant to, Pageable pageable);

    Page<Payment> findByStatusAndPaymentMethodAndCreatedAtBetween(PaymentStatus status, PaymentMethod method, Instant from, Instant to, Pageable pageable);

    @Query("SELECT p.paymentMethod, SUM(p.amount), COUNT(p) FROM Payment p " +
           "WHERE p.status = :status AND p.paidAt BETWEEN :from AND :to " +
           "GROUP BY p.paymentMethod")
    List<Object[]> findRevenueGroupedByMethod(
            @Param("status") PaymentStatus status,
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.orderId = :orderId AND p.status = com.example.paymentservice.entity.enums.PaymentStatus.COMPLETED AND p.paymentMethod != com.example.paymentservice.entity.enums.PaymentMethod.REFUND AND p.isDeleted = false")
    Double sumCompletedByOrderId(@Param("orderId") UUID orderId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM Payment p WHERE p.orderId = :orderId AND p.status = com.example.paymentservice.entity.enums.PaymentStatus.PENDING AND p.isDeleted = false")
    Double sumPendingByOrderId(@Param("orderId") UUID orderId);

    @Query(value = "SELECT DATE_FORMAT(CONVERT_TZ(p.paid_at, '+00:00', '+07:00'), :pattern) AS period, " +
                   "p.payment_method AS method, " +
                   "SUM(p.amount) AS revenue, COUNT(p.id) AS cnt " +
                   "FROM payments p " +
                   "WHERE p.status = 'COMPLETED' AND p.is_deleted = false AND p.paid_at BETWEEN :from AND :to " +
                   "GROUP BY period, p.payment_method ORDER BY period DESC, p.payment_method ASC",
           nativeQuery = true)
    List<Object[]> findRevenueSeriesByPeriod(
            @Param("pattern") String pattern,
            @Param("from") Instant from,
            @Param("to") Instant to);
}
