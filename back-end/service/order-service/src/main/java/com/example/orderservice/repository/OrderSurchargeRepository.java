package com.example.orderservice.repository;

import com.example.orderservice.entity.OrderSurcharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderSurchargeRepository extends JpaRepository<OrderSurcharge, UUID> {
    List<OrderSurcharge> findByOrderId(UUID orderId);
}
