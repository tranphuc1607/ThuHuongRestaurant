package com.example.orderservice.repository;

import com.example.orderservice.entity.Booking;
import com.example.orderservice.entity.enums.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    @EntityGraph(attributePaths = {"diningTable", "items"})
    Optional<Booking> findByBookingCode(String bookingCode);

    @Query("SELECT b FROM Booking b WHERE b.status = 'PENDING_PAYMENT' AND b.createdAt < :cutoff")
    List<Booking> findExpiredPending(@Param("cutoff") Instant cutoff);

    @Query("SELECT b FROM Booking b WHERE b.diningTable.id = :tableId AND b.status = 'CONFIRMED' " +
           "AND b.scheduledTime BETWEEN :from AND :to")
    List<Booking> findConflictingBookings(@Param("tableId") Long tableId,
                                          @Param("from") Instant from,
                                          @Param("to") Instant to);

    @Query("SELECT b FROM Booking b WHERE b.status = 'CONFIRMED' AND b.scheduledTime BETWEEN :now AND :soon AND b.reminderSent = false")
    List<Booking> findUpcoming(@Param("now") Instant now, @Param("soon") Instant soon);

    long countByBookingCodeStartingWith(String prefix);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findByStatus(BookingStatus status, Pageable pageable);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findByScheduledTimeBetween(Instant from, Instant to, Pageable pageable);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findByStatusNot(BookingStatus status, Pageable pageable);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findByStatusAndScheduledTimeBetween(BookingStatus status, Instant from, Instant to, Pageable pageable);

    @EntityGraph(attributePaths = "diningTable")
    Page<Booking> findByStatusNotIn(java.util.Collection<BookingStatus> statuses, Pageable pageable);

    @Modifying
    @Query("UPDATE Booking b SET b.status = 'EXPIRED' WHERE b.status = 'PENDING_PAYMENT' AND b.paymentMethod = 'BANK_TRANSFER' AND b.createdAt < :cutoff")
    int expireUnpaidBookings(@Param("cutoff") Instant cutoff);

    @EntityGraph(attributePaths = {"diningTable", "items"})
    Page<Booking> findByCustomerPhoneOrderByCreatedAtDesc(String customerPhone, Pageable pageable);

    @EntityGraph(attributePaths = {"diningTable", "items"})
    Page<Booking> findByOwnerUsernameOrderByCreatedAtDesc(String ownerUsername, Pageable pageable);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.status = 'PENDING_PAYMENT'")
    long countPendingPayment();

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.status = 'PENDING_PAYMENT' AND b.scheduledTime BETWEEN :from AND :to")
    long countPendingInRange(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.status = 'CONFIRMED' AND b.scheduledTime BETWEEN :from AND :to")
    long countConfirmedInRange(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.scheduledTime BETWEEN :from AND :to AND b.status NOT IN ('EXPIRED', 'CANCELLED')")
    long countActiveInRange(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(b) FROM Booking b WHERE b.status = 'CONFIRMED' AND b.scheduledTime BETWEEN :now AND :soon")
    long countUpcomingConfirmed(@Param("now") Instant now, @Param("soon") Instant soon);
}
