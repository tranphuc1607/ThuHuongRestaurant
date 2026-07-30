package com.example.hrservice.service;

import com.example.hrservice.entity.Attendance;
import com.example.hrservice.entity.AttendanceLog;
import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.Shift;
import com.example.hrservice.entity.ShiftAssignment;
import com.example.hrservice.entity.DTO.req.PunishRequest;
import com.example.hrservice.entity.DTO.req.UpdateAttendanceRequest;
import com.example.hrservice.entity.DTO.res.AttendanceResponse;
import com.example.hrservice.entity.DTO.res.FaceCheckinResponse;
import com.example.hrservice.repository.AttendanceLogRepository;
import com.example.hrservice.repository.AttendanceRepository;
import com.example.hrservice.repository.EmployeeRepository;
import com.example.hrservice.repository.ShiftAssignmentRepository;
import com.example.hrservice.repository.ShiftRepository;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttendanceService {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VN_TIME_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy");

    private final AttendanceRepository attendanceRepository;
    private final AttendanceLogRepository attendanceLogRepository;
    private final EmployeeRepository employeeRepository;
    private final ShiftRepository shiftRepository;
    private final ShiftAssignmentRepository shiftAssignmentRepository;

    // Được gọi từ VerifyController sau khi xác minh WiFi + HMAC token
    @Transactional
    public AttendanceResponse checkIn(UUID employeeId, UUID shiftId) throws MessageException {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên"));
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new MessageException("Không tìm thấy ca làm"));

        LocalDate today = LocalDate.now(VN_ZONE);

        if (attendanceRepository.findByEmployeeIdAndShiftIdAndWorkDate(employeeId, shiftId, today).isPresent()) {
            throw new MessageException("Bạn đã check-in ca " + shift.getName() + " hôm nay rồi");
        }

        Instant now = Instant.now();
        LocalTime checkInVN = now.atZone(VN_ZONE).toLocalTime();
        int lateMinutes = (int) Math.max(0, ChronoUnit.MINUTES.between(shift.getStartTime(), checkInVN));

        Attendance attendance = Attendance.builder()
                .employee(employee)
                .shift(shift)
                .checkInTime(now)
                .workDate(today)
                .lateMinutes(lateMinutes)
                .build();

        return AttendanceResponse.from(attendanceRepository.save(attendance));
    }

    // Được gọi từ VerifyController sau khi xác minh WiFi + HMAC token
    @Transactional
    public AttendanceResponse checkOut(UUID employeeId, UUID shiftId) throws MessageException {
        LocalDate today = LocalDate.now(VN_ZONE);
        Attendance attendance = attendanceRepository.findByEmployeeIdAndShiftIdAndWorkDate(employeeId, shiftId, today)
                .orElseThrow(() -> new MessageException("Chưa có check-in cho ca này hôm nay"));

        if (attendance.getCheckOutTime() != null) {
            throw new MessageException("Bạn đã check-out ca này rồi");
        }

        Instant now = Instant.now();
        double totalHours = Duration.between(attendance.getCheckInTime(), now).toMinutes() / 60.0;
        attendance.setCheckOutTime(now);
        attendance.setTotalHours(Math.round(totalHours * 100.0) / 100.0);

        return AttendanceResponse.from(attendanceRepository.save(attendance));
    }

    public Page<AttendanceResponse> getAll(UUID employeeId, int month, int year, int page, int size) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.plusMonths(1).minusDays(1);
        return attendanceRepository.findFiltered(employeeId, start, end, PageRequest.of(page, size))
                .map(AttendanceResponse::from);
    }

    public AttendanceResponse getById(UUID id) throws MessageException {
        return AttendanceResponse.from(findById(id));
    }

    // Admin sửa giờ check-in hoặc check-out
    @Transactional
    public AttendanceResponse update(UUID id, UpdateAttendanceRequest req, String adminUsername) throws MessageException {
        Attendance attendance = findById(id);

        Instant newTime = Instant.parse(req.getNewTime());
        String oldValue;

        if ("checkInTime".equals(req.getField())) {
            oldValue = attendance.getCheckInTime() != null ? attendance.getCheckInTime().toString() : null;
            attendance.setCheckInTime(newTime);
            // Recalculate lateMinutes chỉ khi có shift
            if (attendance.getShift() != null) {
                LocalTime newCheckInVN = newTime.atZone(VN_ZONE).toLocalTime();
                attendance.setLateMinutes((int) Math.max(0,
                        ChronoUnit.MINUTES.between(attendance.getShift().getStartTime(), newCheckInVN)));
            }
        } else if ("checkOutTime".equals(req.getField())) {
            oldValue = attendance.getCheckOutTime() != null ? attendance.getCheckOutTime().toString() : null;
            attendance.setCheckOutTime(newTime);
            if (attendance.getCheckInTime() != null) {
                double totalHours = Duration.between(attendance.getCheckInTime(), newTime).toMinutes() / 60.0;
                attendance.setTotalHours(Math.round(totalHours * 100.0) / 100.0);
            }
        } else {
            throw new MessageException("Trường không hợp lệ. Chỉ chấp nhận: checkInTime, checkOutTime");
        }

        attendanceRepository.save(attendance);

        AttendanceLog log = AttendanceLog.builder()
                .attendance(attendance)
                .editedBy(adminUsername)
                .fieldChanged(req.getField())
                .oldValue(oldValue)
                .newValue(newTime.toString())
                .reason(req.getReason())
                .build();
        attendanceLogRepository.save(log);

        return AttendanceResponse.from(attendance);
    }

    @Transactional
    public AttendanceResponse punish(UUID id, PunishRequest req) throws MessageException {
        Attendance attendance = findById(id);
        attendance.setPunished(true);
        attendance.setPunishmentAmount(req.getAmount());
        attendance.setPunishmentReason(req.getReason());
        return AttendanceResponse.from(attendanceRepository.save(attendance));
    }

    @Transactional
    public AttendanceResponse removePunishment(UUID id) throws MessageException {
        Attendance attendance = findById(id);
        attendance.setPunished(false);
        attendance.setPunishmentAmount(null);
        attendance.setPunishmentReason(null);
        return AttendanceResponse.from(attendanceRepository.save(attendance));
    }

    // Dùng cho bot /myattendance
    public List<AttendanceResponse> getByEmployeeAndMonth(UUID employeeId, int month, int year) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.plusMonths(1).minusDays(1);
        return attendanceRepository.findByEmployeeIdAndWorkDateBetweenOrderByWorkDateAsc(employeeId, start, end)
                .stream().map(AttendanceResponse::from).collect(Collectors.toList());
    }

    private Attendance findById(UUID id) throws MessageException {
        return attendanceRepository.findById(id)
                .orElseThrow(() -> new MessageException("Không tìm thấy bản ghi chấm công với ID: " + id));
    }

    // Được gọi từ VerifyController sau khi kiosk nhận dạng khuôn mặt thành công.
    // Ca làm là optional — nếu có thì dùng để tính lateMinutes, không có vẫn check-in được.
    // Mỗi ngày chỉ 1 cặp check-in / check-out (không phân theo từng ca).
    @Transactional
    public FaceCheckinResponse faceCheckIn(UUID employeeId) throws MessageException {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new MessageException("Không tìm thấy nhân viên"));

        LocalDate today = LocalDate.now(VN_ZONE);

        // Nếu có record đang mở (check-in nhưng chưa check-out) → CHECK_OUT
        Optional<Attendance> open = attendanceRepository
                .findByEmployeeIdAndWorkDateAndCheckOutTimeIsNull(employeeId, today);
        if (open.isPresent()) {
            Attendance a = open.get();
            Instant now = Instant.now();
            a.setCheckOutTime(now);
            a.setTotalHours(Math.round(Duration.between(a.getCheckInTime(), now).toMinutes() / 60.0 * 100.0) / 100.0);
            return FaceCheckinResponse.builder()
                    .action("CHECK_OUT")
                    .employeeName(employee.getName())
                    .attendance(AttendanceResponse.from(attendanceRepository.save(a)))
                    .build();
        }

        // Nếu đã có record hoàn chỉnh hôm nay → đã hoàn tất
        boolean done = attendanceRepository.findByEmployeeIdAndWorkDate(employeeId, today)
                .stream().anyMatch(a -> a.getCheckOutTime() != null);
        if (done) {
            throw new MessageException("Nhân viên " + employee.getName() + " đã hoàn tất chấm công hôm nay");
        }

        // CHECK_IN — tìm ca gần nhất nếu có (chỉ để tính lateMinutes)
        LocalTime nowVN = LocalTime.now(VN_ZONE);
        DayOfWeek dow = today.getDayOfWeek();
        int lateMinutes = 0;
        Shift nearestShift = null;
        List<ShiftAssignment> assignments = shiftAssignmentRepository
                .findActiveByEmployeeAndDay(employeeId, dow, today);
        if (!assignments.isEmpty()) {
            ShiftAssignment best = assignments.stream()
                    .min(Comparator.comparingLong(sa ->
                            Math.abs(ChronoUnit.MINUTES.between(sa.getShift().getStartTime(), nowVN))))
                    .orElse(null);
            if (best != null) {
                nearestShift = best.getShift();
                lateMinutes = (int) Math.max(0,
                        ChronoUnit.MINUTES.between(nearestShift.getStartTime(), nowVN));
            }
        }

        Attendance a = Attendance.builder()
                .employee(employee)
                .shift(nearestShift)
                .checkInTime(Instant.now())
                .workDate(today)
                .lateMinutes(lateMinutes)
                .build();
        return FaceCheckinResponse.builder()
                .action("CHECK_IN")
                .employeeName(employee.getName())
                .attendance(AttendanceResponse.from(attendanceRepository.save(a)))
                .build();
    }
}
