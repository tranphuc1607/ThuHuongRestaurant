package com.example.hrservice.repository;

import com.example.hrservice.entity.ShiftChangeRequest;
import com.example.hrservice.entity.enums.SwapStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ShiftChangeRequestRepository extends JpaRepository<ShiftChangeRequest, Long> {

    @EntityGraph(attributePaths = {"employee", "originalShift", "requestedShift"})
    Optional<ShiftChangeRequest> findByEmployeeIdAndRequestDateAndStatus(Long employeeId, LocalDate date, SwapStatus status);

    @EntityGraph(attributePaths = {"employee", "originalShift", "requestedShift"})
    Optional<ShiftChangeRequest> findById(Long id);

    List<ShiftChangeRequest> findByStatusOrderByCreatedAtDesc(SwapStatus status);
}
