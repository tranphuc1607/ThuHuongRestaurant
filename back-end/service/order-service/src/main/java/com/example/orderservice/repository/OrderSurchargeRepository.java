package com.example.orderservice.repository;

import com.example.orderservice.entity.OrderSurcharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderSurchargeRepository extends JpaRepository<OrderSurcharge, Long> {
    List<OrderSurcharge> findByOrderId(Long orderId);
}
