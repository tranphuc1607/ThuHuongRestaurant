package com.example.hrservice.service;

import com.example.hrservice.entity.Attendance;
import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.DTO.res.PayrollResponse;
import com.example.hrservice.entity.enums.SalaryType;
import com.example.hrservice.repository.AttendanceRepository;
import com.example.hrservice.repository.EmployeeRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PayrollService {

    private final EmployeeRepository employeeRepository;
    private final AttendanceRepository attendanceRepository;

    // Bảng lương toàn bộ nhân viên trong tháng
    public List<PayrollResponse> calculateAll(int month, int year) {
        return employeeRepository.findAll().stream()
                .filter(Employee::isActive)
                .map(e -> calculate(e, month, year))
                .collect(Collectors.toList());
    }

    // Lương của một nhân viên
    public PayrollResponse calculateOne(Long employeeId, int month, int year) throws MessageException {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên"));
        return calculate(employee, month, year);
    }

    private PayrollResponse calculate(Employee employee, int month, int year) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.plusMonths(1).minusDays(1);

        List<Attendance> attendances = attendanceRepository
                .findByEmployeeIdAndWorkDateBetweenOrderByWorkDateAsc(employee.getId(), start, end);

        double totalHours = attendances.stream()
                .mapToDouble(a -> a.getTotalHours() != null ? a.getTotalHours() : 0.0)
                .sum();

        long actualWorkDays = attendances.stream()
                .map(Attendance::getWorkDate)
                .distinct()
                .count();

        double totalPunishment = attendances.stream()
                .filter(Attendance::isPunished)
                .mapToDouble(a -> a.getPunishmentAmount() != null ? a.getPunishmentAmount() : 0.0)
                .sum();

        double gross;
        if (employee.getSalaryType() == SalaryType.HOURLY) {
            gross = totalHours * employee.getBaseValue();
        } else {
            // FIXED: tính theo số ngày thực tế / ngày chuẩn
            int targetDays = employee.getTargetDays() != null ? employee.getTargetDays() : 26;
            double dailyRate = employee.getBaseValue() / targetDays;
            gross = dailyRate * actualWorkDays;
        }

        double net = Math.max(0, gross - totalPunishment);

        return PayrollResponse.builder()
                .employeeId(employee.getId())
                .employeeName(employee.getName())
                .employeeType(employee.getType())
                .salaryType(employee.getSalaryType())
                .baseValue(employee.getBaseValue())
                .targetDays(employee.getTargetDays())
                .month(month)
                .year(year)
                .actualWorkDays(actualWorkDays)
                .totalHours(Math.round(totalHours * 100.0) / 100.0)
                .totalPunishment(totalPunishment)
                .gross(Math.round(gross * 100.0) / 100.0)
                .net(Math.round(net * 100.0) / 100.0)
                .build();
    }
}
