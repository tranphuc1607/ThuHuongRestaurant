package com.example.hrservice.repository;

import com.example.hrservice.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByTelegramId(Long telegramId);

    Optional<Employee> findByPhone(String phone);

    Page<Employee> findByActiveTrue(Pageable pageable);

    Page<Employee> findByNameContainingIgnoreCaseAndActiveTrue(String name, Pageable pageable);
}
