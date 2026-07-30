package com.example.hrservice.repository;

import com.example.hrservice.entity.Attendance;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {

    // Kiểm tra đã check-in ca này hôm nay chưa (dùng trong VerifyController WiFi/HMAC)
    Optional<Attendance> findByEmployeeIdAndShiftIdAndWorkDate(UUID employeeId, UUID shiftId, LocalDate workDate);

    // Tìm record đang mở (check-in nhưng chưa check-out) trong ngày — dùng cho face check-in
    Optional<Attendance> findByEmployeeIdAndWorkDateAndCheckOutTimeIsNull(UUID employeeId, LocalDate workDate);

    // Tất cả record trong ngày của nhân viên — dùng để kiểm tra đã hoàn tất chưa
    List<Attendance> findByEmployeeIdAndWorkDate(UUID employeeId, LocalDate workDate);

    // Attendance theo tháng của một nhân viên (dùng cho payroll + /myattendance)
    @EntityGraph(attributePaths = {"employee", "shift"})
    List<Attendance> findByEmployeeIdAndWorkDateBetweenOrderByWorkDateAsc(UUID employeeId, LocalDate start, LocalDate end);

    // Danh sách attendance để admin xem (có filter)
    @EntityGraph(attributePaths = {"employee", "shift"})
    @Query("SELECT a FROM Attendance a WHERE (:employeeId IS NULL OR a.employee.id = :employeeId) " +
           "AND a.workDate BETWEEN :start AND :end")
    Page<Attendance> findFiltered(@Param("employeeId") UUID employeeId,
                                   @Param("start") LocalDate start,
                                   @Param("end") LocalDate end,
                                   Pageable pageable);

    @EntityGraph(attributePaths = {"employee", "shift"})
    Optional<Attendance> findById(UUID id);
}
