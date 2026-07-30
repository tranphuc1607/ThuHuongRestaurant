package com.example.hrservice.repository;

import com.example.hrservice.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    Optional<Employee> findByTelegramId(Long telegramId);

    Optional<Employee> findByPhone(String phone);

    Optional<Employee> findByUserId(UUID userId);

    Page<Employee> findByActiveTrue(Pageable pageable);

    Page<Employee> findByNameContainingIgnoreCaseAndActiveTrue(String name, Pageable pageable);

    @Query("SELECT e FROM Employee e WHERE e.active = true AND e.faceDescriptor IS NOT NULL AND e.faceDescriptor <> ''")
    List<Employee> findAllWithFaceDescriptor();
}
