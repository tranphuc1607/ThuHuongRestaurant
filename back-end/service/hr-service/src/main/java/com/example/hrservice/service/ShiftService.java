package com.example.hrservice.service;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.Shift;
import com.example.hrservice.entity.ShiftAssignment;
import com.example.hrservice.entity.DTO.req.AssignShiftRequest;
import com.example.hrservice.entity.DTO.req.CreateShiftRequest;
import com.example.hrservice.entity.DTO.res.ShiftAssignmentResponse;
import com.example.hrservice.entity.DTO.res.ShiftResponse;
import com.example.hrservice.repository.EmployeeRepository;
import com.example.hrservice.repository.ShiftAssignmentRepository;
import com.example.hrservice.repository.ShiftRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final EmployeeRepository employeeRepository;

    public List<ShiftResponse> getAll() {
        return shiftRepository.findByActiveTrue().stream()
                .map(ShiftResponse::from)
                .collect(Collectors.toList());
    }

    public ShiftResponse getById(Long id) throws MessageException {
        return ShiftResponse.from(findById(id));
    }

    @Transactional
    public ShiftResponse create(CreateShiftRequest req) {
        boolean overnight = req.getEndTime().isBefore(req.getStartTime());
        double durationMinutes;
        if (overnight) {
            durationMinutes = 24 * 60 + ChronoUnit.MINUTES.between(req.getStartTime(), req.getEndTime());
        } else {
            durationMinutes = ChronoUnit.MINUTES.between(req.getStartTime(), req.getEndTime());
        }
        Shift shift = Shift.builder()
                .name(req.getName())
                .startTime(req.getStartTime())
                .endTime(req.getEndTime())
                .overnight(overnight)
                .durationHours(durationMinutes / 60.0)
                .build();
        return ShiftResponse.from(shiftRepository.save(shift));
    }

    @Transactional
    public ShiftResponse update(Long id, CreateShiftRequest req) throws MessageException {
        Shift shift = findById(id);
        boolean overnight = req.getEndTime().isBefore(req.getStartTime());
        double durationMinutes;
        if (overnight) {
            durationMinutes = 24 * 60 + ChronoUnit.MINUTES.between(req.getStartTime(), req.getEndTime());
        } else {
            durationMinutes = ChronoUnit.MINUTES.between(req.getStartTime(), req.getEndTime());
        }
        shift.setName(req.getName());
        shift.setStartTime(req.getStartTime());
        shift.setEndTime(req.getEndTime());
        shift.setOvernight(overnight);
        shift.setDurationHours(durationMinutes / 60.0);
        return ShiftResponse.from(shiftRepository.save(shift));
    }

    @Transactional
    public void deactivate(Long id) throws MessageException {
        Shift shift = findById(id);
        shift.setActive(false);
        shiftRepository.save(shift);
    }

    @Transactional
    public List<ShiftAssignmentResponse> assignShift(AssignShiftRequest req) throws MessageException {
        Employee employee = employeeRepository.findById(req.getEmployeeId())
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên"));
        Shift shift = findById(req.getShiftId());

        List<ShiftAssignment> created = new ArrayList<>();
        for (DayOfWeek day : req.getDaysOfWeek()) {
            // Vô hiệu hóa phân ca cũ cùng ngày (nếu có)
            shiftAssignmentRepository.findActiveByEmployeeAndDay(
                    employee.getId(), day, req.getEffectiveFrom())
                    .forEach(sa -> {
                        sa.setActive(false);
                        shiftAssignmentRepository.save(sa);
                    });

            ShiftAssignment assignment = ShiftAssignment.builder()
                    .employee(employee)
                    .shift(shift)
                    .dayOfWeek(day)
                    .effectiveFrom(req.getEffectiveFrom())
                    .effectiveTo(req.getEffectiveTo())
                    .build();
            created.add(shiftAssignmentRepository.save(assignment));
        }
        return created.stream().map(ShiftAssignmentResponse::from).collect(Collectors.toList());
    }

    public List<ShiftAssignmentResponse> getAssignments(Long employeeId) {
        return shiftAssignmentRepository.findActiveByEmployee(employeeId)
                .stream().map(ShiftAssignmentResponse::from).collect(Collectors.toList());
    }

    // Lịch tuần: offset = 0 (tuần này), 1 (tuần sau), -1 (tuần trước)
    public List<ShiftAssignmentResponse> getWeekSchedule(int weekOffset) {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.with(DayOfWeek.MONDAY).plusWeeks(weekOffset);
        return shiftAssignmentRepository.findAllActiveForDate(weekStart)
                .stream().map(ShiftAssignmentResponse::from).collect(Collectors.toList());
    }

    public Shift findById(Long id) throws MessageException {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy ca làm với ID: " + id));
    }
}
