package com.example.hrservice.repository;

import com.example.hrservice.entity.ShiftAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ShiftAssignmentRepository extends JpaRepository<ShiftAssignment, Long> {

    // Tìm ca hôm nay cho một nhân viên (dùng trong bot /checkin)
    @Query("SELECT sa FROM ShiftAssignment sa JOIN FETCH sa.shift " +
           "WHERE sa.employee.id = :employeeId " +
           "AND sa.dayOfWeek = :dayOfWeek " +
           "AND sa.active = true " +
           "AND sa.effectiveFrom <= :today " +
           "AND (sa.effectiveTo IS NULL OR sa.effectiveTo >= :today)")
    List<ShiftAssignment> findActiveByEmployeeAndDay(@Param("employeeId") Long employeeId,
                                                      @Param("dayOfWeek") DayOfWeek dayOfWeek,
                                                      @Param("today") LocalDate today);

    // Tìm ca trùng chính xác (cùng shift + ngày) để deactivate trước khi tạo mới
    @Query("SELECT sa FROM ShiftAssignment sa " +
           "WHERE sa.employee.id = :employeeId " +
           "AND sa.shift.id = :shiftId " +
           "AND sa.dayOfWeek = :dayOfWeek " +
           "AND sa.active = true")
    List<ShiftAssignment> findDuplicate(@Param("employeeId") Long employeeId,
                                        @Param("shiftId") Long shiftId,
                                        @Param("dayOfWeek") DayOfWeek dayOfWeek);

    // Toàn bộ phân ca đang active của một nhân viên
    @Query("SELECT sa FROM ShiftAssignment sa JOIN FETCH sa.shift " +
           "WHERE sa.employee.id = :employeeId AND sa.active = true ORDER BY sa.dayOfWeek")
    List<ShiftAssignment> findActiveByEmployee(@Param("employeeId") Long employeeId);

    // Tất cả phân ca active có overlap với một tuần [weekStart, weekEnd]
    @Query("SELECT sa FROM ShiftAssignment sa JOIN FETCH sa.shift JOIN FETCH sa.employee " +
           "WHERE sa.active = true " +
           "AND sa.employee.active = true " +
           "AND sa.effectiveFrom <= :weekEnd " +
           "AND (sa.effectiveTo IS NULL OR sa.effectiveTo >= :weekStart)")
    List<ShiftAssignment> findAllActiveForWeek(@Param("weekStart") LocalDate weekStart,
                                               @Param("weekEnd") LocalDate weekEnd);

    // Phân ca active của 1 nhân viên trong 1 tuần cụ thể
    @Query("SELECT sa FROM ShiftAssignment sa " +
           "WHERE sa.employee.id = :employeeId " +
           "AND sa.active = true " +
           "AND sa.effectiveFrom <= :weekEnd " +
           "AND (sa.effectiveTo IS NULL OR sa.effectiveTo >= :weekStart)")
    List<ShiftAssignment> findActiveByEmployeeForWeek(@Param("employeeId") Long employeeId,
                                                       @Param("weekStart") LocalDate weekStart,
                                                       @Param("weekEnd") LocalDate weekEnd);
}
