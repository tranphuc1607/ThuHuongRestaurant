package com.example.orderservice.repository;

import com.example.orderservice.entity.DiningTable;
import com.example.orderservice.entity.enums.TableStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DiningTableRepository extends JpaRepository<DiningTable, UUID> {

    Optional<DiningTable> findByQrToken(String qrToken);

    boolean existsByTableNumber(Integer tableNumber);

    List<DiningTable> findAllByOrderByTableNumberAsc();

    List<DiningTable> findByStatus(TableStatus status);

    List<DiningTable> findByZoneIsNull();
}
