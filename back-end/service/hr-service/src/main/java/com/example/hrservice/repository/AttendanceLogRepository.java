package com.example.hrservice.repository;

import com.example.hrservice.entity.AttendanceLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceLogRepository extends JpaRepository<AttendanceLog, Long> {

    List<AttendanceLog> findByAttendanceIdOrderByEditedAtDesc(Long attendanceId);
}
