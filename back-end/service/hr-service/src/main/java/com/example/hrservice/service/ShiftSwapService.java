package com.example.hrservice.service;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.Shift;
import com.example.hrservice.entity.ShiftAssignment;
import com.example.hrservice.entity.ShiftChangeRequest;
import com.example.hrservice.entity.enums.SwapStatus;
import com.example.hrservice.repository.EmployeeRepository;
import com.example.hrservice.repository.ShiftAssignmentRepository;
import com.example.hrservice.repository.ShiftChangeRequestRepository;
import com.example.hrservice.repository.ShiftRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShiftSwapService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final ShiftChangeRequestRepository swapRepository;
    private final ShiftRepository shiftRepository;
    private final EmployeeRepository employeeRepository;
    private final ShiftAssignmentRepository assignmentRepository;

    /**
     * Đổi ca ngay lập tức (auto-approved).
     * Validates: có ca hôm nay, còn trên 1 tiếng trước ca, chưa đổi ca hôm nay rồi.
     * Nếu < 1 tiếng → ném exception, nhân viên phải liên hệ admin sửa thủ công.
     */
    @Transactional
    public ShiftChangeRequest requestSwap(Long employeeId, Long requestedShiftId) throws MessageException {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên"));

        LocalDate today = LocalDate.now(VN_ZONE);
        DayOfWeek dow = today.getDayOfWeek();

        List<ShiftAssignment> assignments = assignmentRepository
                .findActiveByEmployeeAndDay(employeeId, dow, today);
        if (assignments.isEmpty()) {
            throw new MessageException("Hôm nay bạn không có ca làm việc");
        }
        Shift originalShift = assignments.get(0).getShift();

        // Kiểm tra rule 1 tiếng — nếu vi phạm phải nhờ admin sửa thủ công
        ZonedDateTime shiftStart = today.atTime(originalShift.getStartTime()).atZone(VN_ZONE);
        if (ZonedDateTime.now(VN_ZONE).isAfter(shiftStart.minusHours(1))) {
            throw new MessageException(
                    "Đã quá hạn tự đổi ca (phải đổi trước " + originalShift.getStartTime() + " ít nhất 1 tiếng).\n" +
                    "Vui lòng liên hệ quản lý để được điều chỉnh thủ công.");
        }

        // Kiểm tra đã đổi ca hôm nay rồi
        swapRepository.findByEmployeeIdAndRequestDateAndStatus(employeeId, today, SwapStatus.APPROVED)
                .ifPresent(r -> {
                    throw new RuntimeException("Bạn đã đổi sang ca " + r.getRequestedShift().getName() + " hôm nay rồi");
                });

        Shift requestedShift = shiftRepository.findById(requestedShiftId)
                .orElseThrow(() -> new MessageException("Ca làm không hợp lệ"));
        if (requestedShift.getId().equals(originalShift.getId())) {
            throw new MessageException("Không thể đổi sang cùng ca hiện tại");
        }

        // Tự động approved — không cần admin duyệt
        ShiftChangeRequest request = ShiftChangeRequest.builder()
                .employee(employee)
                .originalShift(originalShift)
                .requestedShift(requestedShift)
                .requestDate(today)
                .status(SwapStatus.APPROVED)
                .build();
        return swapRepository.save(request);
    }

    public Optional<ShiftChangeRequest> findApprovedForToday(Long employeeId) {
        return swapRepository.findByEmployeeIdAndRequestDateAndStatus(
                employeeId, LocalDate.now(VN_ZONE), SwapStatus.APPROVED);
    }

    // Danh sách ca có thể đổi sang (tất cả ca active trừ ca hiện tại)
    public List<Shift> getAvailableShifts(Long currentShiftId) {
        return shiftRepository.findByActiveTrue().stream()
                .filter(s -> !s.getId().equals(currentShiftId))
                .collect(Collectors.toList());
    }

    public ShiftChangeRequest findById(Long id) throws MessageException {
        return swapRepository.findById(id)
                .orElseThrow(() -> new MessageException("Yêu cầu đổi ca không tìm thấy"));
    }
}
