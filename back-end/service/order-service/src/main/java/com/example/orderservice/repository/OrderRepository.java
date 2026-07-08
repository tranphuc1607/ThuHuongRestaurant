package com.example.orderservice.repository;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.Order;
import com.example.orderservice.entity.enums.OrderStatus;
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
public interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("SELECT o FROM Order o JOIN FETCH o.diningTable LEFT JOIN FETCH o.items WHERE o.diningTable = :table AND o.status IN :statuses")
    Optional<Order> findByDiningTableAndStatusIn(@Param("table") DiningTable table, @Param("statuses") List<OrderStatus> statuses);

    boolean existsByDiningTableAndStatusIn(DiningTable table, List<OrderStatus> statuses);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.diningTable WHERE o.status = :status")
    Page<Order> findByStatus(@Param("status") OrderStatus status, Pageable pageable);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.diningTable WHERE o.diningTable = :table")
    Page<Order> findByDiningTable(@Param("table") DiningTable table, Pageable pageable);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.diningTable WHERE o.diningTable = :table AND o.status = :status")
    Page<Order> findByDiningTableAndStatus(@Param("table") DiningTable table, @Param("status") OrderStatus status, Pageable pageable);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.diningTable")
    Page<Order> findAll(Pageable pageable);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.diningTable LEFT JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItemsAndTable(@Param("id") Long id);

    @Query("SELECT o.status, COUNT(o) FROM Order o WHERE o.createdAt BETWEEN :from AND :to GROUP BY o.status")
    List<Object[]> countByStatusBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("SELECT COUNT(DISTINCT o.diningTable.id) FROM Order o WHERE o.status IN :statuses")
    long countOccupiedTables(@Param("statuses") List<OrderStatus> statuses);

    // Xóa vật lý — bypass @SQLDelete + @Version (dùng cho đơn 0 món)
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "DELETE FROM orders WHERE id = :id", nativeQuery = true)
    void physicalDeleteById(@Param("id") Long id);
}
