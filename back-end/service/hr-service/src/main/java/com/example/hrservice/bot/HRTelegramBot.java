package com.example.hrservice.bot;

import com.example.hrservice.entity.Employee;
import com.example.hrservice.entity.Shift;
import com.example.hrservice.entity.ShiftAssignment;
import com.example.hrservice.entity.ShiftChangeRequest;
import com.example.hrservice.entity.DTO.res.AttendanceResponse;
import com.example.hrservice.entity.DTO.res.PayrollResponse;
import com.example.hrservice.repository.ShiftAssignmentRepository;
import com.example.hrservice.repository.ShiftRepository;
import com.example.hrservice.service.AttendanceService;
import com.example.hrservice.service.EmployeeService;
import com.example.hrservice.service.PayrollService;
import com.example.hrservice.service.ShiftSwapService;
import com.example.hrservice.util.CheckinTokenUtil;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.AnswerCallbackQuery;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.methods.updatingmessages.EditMessageText;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class HRTelegramBot extends TelegramLongPollingBot {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VN_DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(VN_ZONE);
    private static final DateTimeFormatter VN_TIME_FMT = DateTimeFormatter.ofPattern("HH:mm").withZone(VN_ZONE);

    @Value("${hr.telegram.bot.token:}")
    private String botToken;

    @Value("${hr.telegram.bot.username:}")
    private String botUsername;

    @Value("${hr.telegram.admin-ids:}")
    private String adminIdsRaw;

    @Value("${hr.wifi.allowed-ip:*}")
    private String allowedIp;

    private final EmployeeService employeeService;
    private final AttendanceService attendanceService;
    private final PayrollService payrollService;
    private final ShiftSwapService swapService;
    private final ShiftAssignmentRepository shiftAssignmentRepository;
    private final ShiftRepository shiftRepository;
    private final CheckinTokenUtil checkinTokenUtil;

    // State machine: telegramId → state string
    private final Map<Long, String> pendingState = new ConcurrentHashMap<>();

    @Override
    public String getBotToken() { return botToken; }

    @Override
    public String getBotUsername() { return botUsername; }

    @Override
    public void onUpdateReceived(Update update) {
        try {
            if (update.hasMessage() && update.getMessage().hasText()) {
                handleMessage(update);
            } else if (update.hasCallbackQuery()) {
                handleCallback(update);
            }
        } catch (Exception e) {
            log.error("[HR Bot] Lỗi xử lý update: {}", e.getMessage(), e);
        }
    }

    // ─────────────────── Message handlers ───────────────────

    private void handleMessage(Update update) throws TelegramApiException {
        long chatId = update.getMessage().getChatId();
        long telegramId = update.getMessage().getFrom().getId();
        String text = update.getMessage().getText().trim();

        // Xử lý trạng thái multi-step trước
        if (pendingState.containsKey(telegramId)) {
            handleStatefulInput(chatId, telegramId, text);
            return;
        }

        switch (text.split(" ")[0].toLowerCase()) {
            case "/start"        -> handleStart(chatId);
            case "/register"     -> handleRegister(chatId, telegramId);
            case "/checkin"      -> handleCheckin(chatId, telegramId);
            case "/checkout"     -> handleCheckout(chatId, telegramId);
            case "/swapshift"    -> handleSwapShift(chatId, telegramId);
            case "/myshift"      -> handleMyShift(chatId, telegramId);
            case "/myattendance" -> handleMyAttendance(chatId, telegramId);
            case "/salary"       -> handleSalary(chatId, telegramId);
            case "/employees"    -> handleEmployees(chatId, telegramId);
            default              -> send(chatId, "Lệnh không hợp lệ. Gõ /start để xem danh sách lệnh.");
        }
    }

    private void handleStart(long chatId) throws TelegramApiException {
        String msg = "👋 *Chào mừng đến với HR Bot - Nhà hàng Thư Hương!*\n\n" +
                     "*Nhân viên:*\n" +
                     "/register — Đăng ký tài khoản\n" +
                     "/checkin — Check-in vào ca\n" +
                     "/checkout — Check-out khỏi ca\n" +
                     "/swapshift — Xin đổi ca hôm nay\n" +
                     "/myshift — Lịch ca tuần này\n" +
                     "/myattendance — Chấm công tháng này _(từ ngày 25)_\n" +
                     "/salary — Lương tháng này _(từ ngày 25)_\n\n" +
                     "*Quản lý:*\n" +
                     "/employees — Danh sách nhân viên";
        sendMarkdown(chatId, msg);
    }

    private void handleRegister(long chatId, long telegramId) throws TelegramApiException {
        try {
            Employee emp = employeeService.findByTelegramId(telegramId);
            sendMarkdown(chatId, "✅ Bạn đã đăng ký rồi: *" + emp.getName() + "*");
        } catch (MessageException e) {
            pendingState.put(telegramId, "AWAITING_PHONE");
            sendMarkdown(chatId, "📱 Vui lòng nhập *số điện thoại* đã đăng ký với nhà hàng:");
        }
    }

    private void handleStatefulInput(long chatId, long telegramId, String input) throws TelegramApiException {
        String state = pendingState.remove(telegramId);

        if ("AWAITING_PHONE".equals(state)) {
            try {
                employeeService.linkTelegram(telegramId, input.trim());
                Employee emp = employeeService.findByTelegramId(telegramId);
                sendMarkdown(chatId, "✅ Đăng ký thành công!\nXin chào *" + emp.getName() + "* 👋");
            } catch (MessageException e) {
                send(chatId, "❌ " + e.getMessage());
            }
        }
    }

    private void handleCheckin(long chatId, long telegramId) throws TelegramApiException {
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            LocalDate today = LocalDate.now(VN_ZONE);
            DayOfWeek dow = today.getDayOfWeek();

            List<ShiftAssignment> assignments = shiftAssignmentRepository
                    .findActiveByEmployeeAndDay(employee.getId(), dow, today);
            if (assignments.isEmpty()) {
                send(chatId, "📅 Hôm nay bạn không có ca làm việc.");
                return;
            }

            // Nếu có ca được duyệt đổi, dùng ca đó
            Shift shift = swapService.findApprovedForToday(employee.getId())
                    .map(ShiftChangeRequest::getRequestedShift)
                    .orElse(assignments.get(0).getShift());

            String timeRange = shift.getStartTime() + " – " + shift.getEndTime();
            String swapNote = swapService.findApprovedForToday(employee.getId()).isPresent()
                    ? "\n✅ _(Ca đã được đổi)_" : "";

            if (isDevMode()) {
                long issuedAt = Instant.now().getEpochSecond();
                execute(SendMessage.builder()
                        .chatId(chatId)
                        .text("📋 *Ca hôm nay:* " + shift.getName() + " (" + timeRange + ")\n" +
                              "👤 *" + employee.getName() + "*" + swapNote + "\n\n" +
                              "⚠️ [Dev] Bấm xác nhận để check-in trực tiếp _(hết hạn sau 5 phút)_.")
                        .parseMode("Markdown")
                        .replyMarkup(buildCallbackButton("✅ Xác nhận Check-in",
                                "CONFIRM_CHECKIN:" + employee.getId() + ":" + shift.getId() + ":" + issuedAt))
                        .build());
            } else {
                String verifyUrl = checkinTokenUtil.generateVerifyUrl(employee.getId(), shift.getId(), "IN");
                execute(SendMessage.builder()
                        .chatId(chatId)
                        .text("📋 *Ca hôm nay:* " + shift.getName() + " (" + timeRange + ")\n" +
                              "👤 *" + employee.getName() + "*" + swapNote + "\n\n" +
                              "⚠️ Vui lòng kết nối WiFi nội bộ trước khi bấm xác nhận.")
                        .parseMode("Markdown")
                        .replyMarkup(buildUrlButton("✅ Xác nhận Check-in", verifyUrl))
                        .build());
            }

        } catch (MessageException e) {
            send(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleCheckout(long chatId, long telegramId) throws TelegramApiException {
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            LocalDate today = LocalDate.now(VN_ZONE);
            DayOfWeek dow = today.getDayOfWeek();

            List<ShiftAssignment> assignments = shiftAssignmentRepository
                    .findActiveByEmployeeAndDay(employee.getId(), dow, today);
            if (assignments.isEmpty()) {
                send(chatId, "📅 Hôm nay bạn không có ca làm việc.");
                return;
            }

            Shift shift = swapService.findApprovedForToday(employee.getId())
                    .map(ShiftChangeRequest::getRequestedShift)
                    .orElse(assignments.get(0).getShift());

            if (isDevMode()) {
                long issuedAt = Instant.now().getEpochSecond();
                execute(SendMessage.builder()
                        .chatId(chatId)
                        .text("📋 *Ca hôm nay:* " + shift.getName() + "\n" +
                              "👤 *" + employee.getName() + "*\n\n" +
                              "⚠️ [Dev] Bấm xác nhận để check-out trực tiếp _(hết hạn sau 5 phút)_.")
                        .parseMode("Markdown")
                        .replyMarkup(buildCallbackButton("✅ Xác nhận Check-out",
                                "CONFIRM_CHECKOUT:" + employee.getId() + ":" + shift.getId() + ":" + issuedAt))
                        .build());
            } else {
                String verifyUrl = checkinTokenUtil.generateVerifyUrl(employee.getId(), shift.getId(), "OUT");
                execute(SendMessage.builder()
                        .chatId(chatId)
                        .text("📋 *Ca hôm nay:* " + shift.getName() + "\n" +
                              "👤 *" + employee.getName() + "*\n\n" +
                              "⚠️ Vui lòng kết nối WiFi nội bộ trước khi bấm xác nhận.")
                        .parseMode("Markdown")
                        .replyMarkup(buildUrlButton("✅ Xác nhận Check-out", verifyUrl))
                        .build());
            }

        } catch (MessageException e) {
            send(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleSwapShift(long chatId, long telegramId) throws TelegramApiException {
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            LocalDate today = LocalDate.now(VN_ZONE);
            DayOfWeek dow = today.getDayOfWeek();

            List<ShiftAssignment> assignments = shiftAssignmentRepository
                    .findActiveByEmployeeAndDay(employee.getId(), dow, today);
            if (assignments.isEmpty()) {
                send(chatId, "📅 Hôm nay bạn không có ca làm việc nên không thể đổi ca.");
                return;
            }

            Shift originalShift = assignments.get(0).getShift();

            // Nếu đã đổi ca hôm nay rồi
            Optional<ShiftChangeRequest> approved = swapService.findApprovedForToday(employee.getId());
            if (approved.isPresent()) {
                sendMarkdown(chatId, "✅ Hôm nay bạn đã đổi sang ca *" +
                        approved.get().getRequestedShift().getName() + "* (" +
                        approved.get().getRequestedShift().getStartTime() + "–" +
                        approved.get().getRequestedShift().getEndTime() + ") rồi.");
                return;
            }

            // Kiểm tra rule 1 tiếng
            ZonedDateTime shiftStart = today.atTime(originalShift.getStartTime()).atZone(VN_ZONE);
            if (ZonedDateTime.now(VN_ZONE).isAfter(shiftStart.minusHours(1))) {
                sendMarkdown(chatId,
                        "❌ Đã quá hạn tự đổi ca.\n" +
                        "Ca *" + originalShift.getName() + "* bắt đầu lúc *" + originalShift.getStartTime() + "*\n\n" +
                        "Vui lòng liên hệ quản lý để được điều chỉnh thủ công.");
                return;
            }

            List<Shift> available = swapService.getAvailableShifts(originalShift.getId());
            if (available.isEmpty()) {
                send(chatId, "Hiện không có ca nào khác để đổi.");
                return;
            }

            List<List<InlineKeyboardButton>> rows = new ArrayList<>();
            for (Shift s : available) {
                rows.add(List.of(InlineKeyboardButton.builder()
                        .text(s.getName() + "  " + s.getStartTime() + "–" + s.getEndTime())
                        .callbackData("SELECT_SHIFT:" + employee.getId() + ":" + s.getId())
                        .build()));
            }

            execute(SendMessage.builder()
                    .chatId(chatId)
                    .text("🔄 *Đổi ca hôm nay*\n" +
                          "Ca hiện tại: *" + originalShift.getName() + "* (" +
                          originalShift.getStartTime() + "–" + originalShift.getEndTime() + ")\n\n" +
                          "Chọn ca muốn đổi sang (có hiệu lực ngay):")
                    .parseMode("Markdown")
                    .replyMarkup(InlineKeyboardMarkup.builder().keyboard(rows).build())
                    .build());

        } catch (MessageException e) {
            sendMarkdown(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleMyShift(long chatId, long telegramId) throws TelegramApiException {
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            List<ShiftAssignment> assignments = shiftAssignmentRepository.findActiveByEmployee(employee.getId());

            if (assignments.isEmpty()) {
                send(chatId, "Bạn chưa được phân ca. Vui lòng liên hệ quản lý.");
                return;
            }

            StringBuilder sb = new StringBuilder("📅 *Lịch ca của bạn:*\n\n");
            for (ShiftAssignment sa : assignments) {
                sb.append("• ").append(formatDow(sa.getDayOfWeek()))
                  .append(": ").append(sa.getShift().getName())
                  .append(" (").append(sa.getShift().getStartTime())
                  .append("–").append(sa.getShift().getEndTime()).append(")\n");
            }

            // Hiển thị đổi ca hôm nay nếu có
            swapService.findApprovedForToday(employee.getId()).ifPresent(r ->
                sb.append("\n✅ *Hôm nay đổi sang:* ")
                  .append(r.getRequestedShift().getName())
                  .append(" (").append(r.getRequestedShift().getStartTime())
                  .append("–").append(r.getRequestedShift().getEndTime()).append(")"));

            sendMarkdown(chatId, sb.toString());
        } catch (MessageException e) {
            send(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleMyAttendance(long chatId, long telegramId) throws TelegramApiException {
        if (!isAdmin(telegramId) && !isEndOfMonth()) {
            send(chatId, "📅 Chấm công chỉ được xem từ ngày 25 hàng tháng.\nQuản lý liên hệ admin nếu cần xem sớm hơn.");
            return;
        }
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            YearMonth now = YearMonth.now();
            List<AttendanceResponse> list = attendanceService.getByEmployeeAndMonth(
                    employee.getId(), now.getMonthValue(), now.getYear());

            if (list.isEmpty()) {
                send(chatId, "Chưa có dữ liệu chấm công tháng " + now.getMonthValue() + "/" + now.getYear() + ".");
                return;
            }

            StringBuilder sb = new StringBuilder("⏱️ *Chấm công tháng " + now.getMonthValue() + "/" + now.getYear() + ":*\n\n");
            for (AttendanceResponse a : list) {
                sb.append(VN_DATE_FMT.format(a.getWorkDate().atStartOfDay(VN_ZONE)))
                  .append(" ").append(a.getShiftName())
                  .append(" | Vào: ").append(VN_TIME_FMT.format(a.getCheckInTime()));
                if (a.getCheckOutTime() != null) {
                    sb.append(" | Ra: ").append(VN_TIME_FMT.format(a.getCheckOutTime()))
                      .append(" | ").append(a.getTotalHours()).append("h");
                } else {
                    sb.append(" | Chưa check-out");
                }
                if (a.getLateMinutes() > 0) sb.append(" | Muộn ").append(a.getLateMinutes()).append("p");
                if (a.isPunished()) sb.append(" ⚠️");
                sb.append("\n");
            }
            sendMarkdown(chatId, sb.toString());
        } catch (MessageException e) {
            send(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleSalary(long chatId, long telegramId) throws TelegramApiException {
        if (!isAdmin(telegramId) && !isEndOfMonth()) {
            send(chatId, "💰 Thông tin lương chỉ được xem từ ngày 25 hàng tháng.\nLiên hệ quản lý nếu cần xem sớm hơn.");
            return;
        }
        try {
            Employee employee = employeeService.findByTelegramId(telegramId);
            YearMonth now = YearMonth.now();
            PayrollResponse p = payrollService.calculateOne(employee.getId(), now.getMonthValue(), now.getYear());

            String msg = "💰 *Lương tháng " + now.getMonthValue() + "/" + now.getYear() + ":*\n\n" +
                         "Số ngày làm: *" + p.getActualWorkDays() + "*\n" +
                         "Tổng giờ: *" + p.getTotalHours() + " giờ*\n" +
                         "Lương gộp: *" + formatVnd(p.getGross()) + "*\n" +
                         (p.getTotalPunishment() > 0 ? "Khấu trừ: *" + formatVnd(p.getTotalPunishment()) + "*\n" : "") +
                         "Lương thực nhận: *" + formatVnd(p.getNet()) + "* ✅";
            sendMarkdown(chatId, msg);
        } catch (MessageException e) {
            send(chatId, "❌ " + e.getMessage());
        }
    }

    private void handleEmployees(long chatId, long telegramId) throws TelegramApiException {
        if (!isAdmin(telegramId)) {
            send(chatId, "❌ Chỉ quản lý mới dùng được lệnh này.");
            return;
        }
        send(chatId, "👥 Xem danh sách nhân viên tại:\nGET /api/v1/hr/employees (cần ADMIN token)");
    }

    // ─────────────────── Callback handlers ───────────────────

    private void handleCallback(Update update) {
        long chatId = update.getCallbackQuery().getMessage().getChatId();
        long telegramId = update.getCallbackQuery().getFrom().getId();
        String callbackQueryId = update.getCallbackQuery().getId();
        String data = update.getCallbackQuery().getData();
        int messageId = update.getCallbackQuery().getMessage().getMessageId();

        try {
            if (data.startsWith("SELECT_SHIFT:")) {
                handleShiftSelected(chatId, messageId, data);
            } else if (data.startsWith("CONFIRM_CHECKIN:")) {
                handleConfirmCheckin(chatId, messageId, data);
            } else if (data.startsWith("CONFIRM_CHECKOUT:")) {
                handleConfirmCheckout(chatId, messageId, data);
            } else if (data.startsWith("EARLY_CHECKIN:")) {
                handleEarlyCheckin(chatId, messageId, data);
            }
        } catch (Exception e) {
            log.error("[HR Bot] Lỗi xử lý callback '{}': {}", data, e.getMessage(), e);
        } finally {
            try {
                execute(AnswerCallbackQuery.builder().callbackQueryId(callbackQueryId).build());
            } catch (TelegramApiException ignored) {}
        }
    }

    // Nhân viên chọn ca muốn đổi → áp dụng ngay, thông báo admin
    private void handleShiftSelected(long chatId, int messageId, String data) {
        // data = "SELECT_SHIFT:{employeeId}:{shiftId}"
        String[] parts = data.split(":");
        Long employeeId = Long.parseLong(parts[1]);
        Long shiftId = Long.parseLong(parts[2]);

        try {
            ShiftChangeRequest request = swapService.requestSwap(employeeId, shiftId);

            editMessage(chatId, messageId,
                    "✅ *Đổi ca thành công!*\n" +
                    "Ca mới hôm nay: *" + request.getRequestedShift().getName() + "* (" +
                    request.getRequestedShift().getStartTime() + "–" +
                    request.getRequestedShift().getEndTime() + ")\n" +
                    "Nhớ check-in đúng giờ nhé!");

            notifyAdminSwapDone(request);

        } catch (Exception e) {
            try {
                editMessage(chatId, messageId, "❌ " + e.getMessage());
            } catch (TelegramApiException ignored) {}
        }
    }

    private void handleConfirmCheckin(long chatId, int messageId, String data) throws TelegramApiException {
        String[] parts = data.split(":");
        Long empId   = Long.parseLong(parts[1]);
        Long shiftId = Long.parseLong(parts[2]);
        long issuedAt = Long.parseLong(parts[3]);

        // 1. Nút hết hạn sau 5 phút
        if (Instant.now().getEpochSecond() - issuedAt > 300) {
            editMessage(chatId, messageId, "⏰ Yêu cầu đã hết hạn. Vui lòng gõ /checkin lại.");
            return;
        }

        try {
            Shift shift = shiftRepository.findById(shiftId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy ca làm"));
            ZonedDateTime now        = ZonedDateTime.now(VN_ZONE);
            LocalDate today          = now.toLocalDate();
            ZonedDateTime shiftStart = today.atTime(shift.getStartTime()).atZone(VN_ZONE);
            ZonedDateTime windowClose= shiftStart.plusHours(2);

            // 2. Kiểm tra quá giờ check-in
            if (now.isAfter(windowClose)) {
                editMessage(chatId, messageId,
                        "❌ Đã quá giờ check-in ca *" + shift.getName() + "*.\n" +
                        "Vui lòng liên hệ quản lý để được điều chỉnh thủ công.");
                return;
            }

            // 3. Đến sớm hơn 15 phút → hỏi xác nhận thêm
            if (now.isBefore(shiftStart.minusMinutes(15))) {
                long minutesEarly = ChronoUnit.MINUTES.between(now, shiftStart);
                execute(EditMessageText.builder()
                        .chatId(chatId).messageId(messageId)
                        .text("⚠️ Bạn đang check-in trước ca *" + minutesEarly + " phút*\n" +
                              "_(Ca " + shift.getName() + " bắt đầu lúc " + shift.getStartTime() + ")_\n\n" +
                              "Bạn chắc chắn muốn check-in không?")
                        .parseMode("Markdown")
                        .replyMarkup(buildCallbackButton("✅ Xác nhận (đến trước ca)",
                                "EARLY_CHECKIN:" + empId + ":" + shiftId + ":" + issuedAt))
                        .build());
                return;
            }

            // 4. Ghi check-in bình thường
            AttendanceResponse resp = attendanceService.checkIn(empId, shiftId);
            String msg = "✅ *Check-in thành công!*\n🕐 " + VN_TIME_FMT.format(resp.getCheckInTime()) +
                    (resp.getLateMinutes() > 0 ? "\n⚠️ Muộn " + resp.getLateMinutes() + " phút" : "");
            editMessage(chatId, messageId, msg);

        } catch (MessageException e) {
            editMessage(chatId, messageId, "❌ " + e.getMessage());
        }
    }

    private void handleEarlyCheckin(long chatId, int messageId, String data) throws TelegramApiException {
        String[] parts = data.split(":");
        Long empId   = Long.parseLong(parts[1]);
        Long shiftId = Long.parseLong(parts[2]);
        long issuedAt = Long.parseLong(parts[3]);

        if (Instant.now().getEpochSecond() - issuedAt > 300) {
            editMessage(chatId, messageId, "⏰ Yêu cầu đã hết hạn. Vui lòng gõ /checkin lại.");
            return;
        }

        try {
            Shift shift = shiftRepository.findById(shiftId)
                    .orElseThrow(() -> new MessageException("Không tìm thấy ca làm"));
            ZonedDateTime now = ZonedDateTime.now(VN_ZONE);
            ZonedDateTime shiftStart = now.toLocalDate().atTime(shift.getStartTime()).atZone(VN_ZONE);
            long minutesEarly = ChronoUnit.MINUTES.between(now, shiftStart);

            AttendanceResponse resp = attendanceService.checkIn(empId, shiftId);
            String msg = "✅ *Check-in thành công!*\n🕐 " + VN_TIME_FMT.format(resp.getCheckInTime()) +
                    "\n⏰ Check-in trước ca *" + minutesEarly + " phút*";
            editMessage(chatId, messageId, msg);

            // Báo admin nếu sớm hơn 1 tiếng
            if (now.isBefore(shiftStart.minusHours(1))) {
                Employee emp = employeeService.findById(empId);
                notifyAdminEarlyCheckin(emp, shift, minutesEarly);
            }
        } catch (MessageException e) {
            editMessage(chatId, messageId, "❌ " + e.getMessage());
        }
    }

    private void handleConfirmCheckout(long chatId, int messageId, String data) throws TelegramApiException {
        String[] parts = data.split(":");
        Long empId   = Long.parseLong(parts[1]);
        Long shiftId = Long.parseLong(parts[2]);
        long issuedAt = Long.parseLong(parts[3]);

        // Nút hết hạn sau 5 phút
        if (Instant.now().getEpochSecond() - issuedAt > 300) {
            editMessage(chatId, messageId, "⏰ Yêu cầu đã hết hạn. Vui lòng gõ /checkout lại.");
            return;
        }

        try {
            AttendanceResponse resp = attendanceService.checkOut(empId, shiftId);
            String msg = "✅ *Check-out thành công!*\n🕐 " + VN_TIME_FMT.format(resp.getCheckOutTime()) +
                    "\n⏱️ Tổng: " + formatHours(resp.getTotalHours());
            editMessage(chatId, messageId, msg);
        } catch (MessageException e) {
            editMessage(chatId, messageId, "❌ " + e.getMessage());
        }
    }

    private void notifyAdminEarlyCheckin(Employee emp, Shift shift, long minutesEarly) {
        if (adminIdsRaw == null || adminIdsRaw.isBlank()) return;
        long hours = minutesEarly / 60;
        long mins  = minutesEarly % 60;
        String timeStr = hours > 0 ? hours + " tiếng " + (mins > 0 ? mins + " phút" : "") : mins + " phút";
        String text = "⚠️ *Cảnh báo check-in sớm*\n\n" +
                "👤 *" + emp.getName() + "*\n" +
                "📋 Ca: " + shift.getName() + " (" + shift.getStartTime() + "–" + shift.getEndTime() + ")\n" +
                "⏰ Check-in sớm hơn *" + timeStr + "* so với giờ bắt đầu ca\n\n" +
                "_Có thể là đi làm sớm do việc đột xuất hoặc gian lận. Vui lòng xác nhận._";
        for (String adminIdStr : adminIdsRaw.split(",")) {
            try {
                execute(SendMessage.builder()
                        .chatId(Long.parseLong(adminIdStr.trim()))
                        .text(text).parseMode("Markdown").build());
            } catch (Exception e) {
                log.error("[HR Bot] Không thể gửi cảnh báo early check-in đến admin {}", adminIdStr);
            }
        }
    }

    // Thông báo admin biết nhân viên đã tự đổi ca (info only, không cần duyệt)
    private void notifyAdminSwapDone(ShiftChangeRequest request) {
        if (adminIdsRaw == null || adminIdsRaw.isBlank()) return;

        String text = "🔄 *Thông báo đổi ca*\n\n" +
                      "👤 *" + request.getEmployee().getName() + "*\n" +
                      "📅 " + VN_DATE_FMT.format(request.getRequestDate().atStartOfDay(VN_ZONE)) + "\n" +
                      "Ca gốc: " + request.getOriginalShift().getName() +
                      " (" + request.getOriginalShift().getStartTime() +
                      "–" + request.getOriginalShift().getEndTime() + ")\n" +
                      "Ca mới: *" + request.getRequestedShift().getName() +
                      " (" + request.getRequestedShift().getStartTime() +
                      "–" + request.getRequestedShift().getEndTime() + ")*\n\n" +
                      "_Đã áp dụng tự động. Nếu cần điều chỉnh, Vui lòng thực hiện trên app._";

        for (String adminIdStr : adminIdsRaw.split(",")) {
            try {
                long adminChatId = Long.parseLong(adminIdStr.trim());
                execute(SendMessage.builder()
                        .chatId(adminChatId)
                        .text(text)
                        .parseMode("Markdown")
                        .build());
            } catch (Exception e) {
                log.error("[HR Bot] Không thể gửi notification đến admin {}: {}", adminIdStr, e.getMessage());
            }
        }
    }

    // ─────────────────── Helper methods ───────────────────

    private InlineKeyboardMarkup buildUrlButton(String label, String url) {
        return InlineKeyboardMarkup.builder()
                .keyboardRow(List.of(InlineKeyboardButton.builder().text(label).url(url).build()))
                .build();
    }

    private InlineKeyboardMarkup buildCallbackButton(String label, String callbackData) {
        return InlineKeyboardMarkup.builder()
                .keyboardRow(List.of(InlineKeyboardButton.builder().text(label).callbackData(callbackData).build()))
                .build();
    }

    private boolean isDevMode() {
        return "*".equals(allowedIp) || "ANY".equalsIgnoreCase(allowedIp);
    }

    private String formatHours(Double hours) {
        if (hours == null) return "?";
        int h = (int) Math.floor(hours);
        int m = (int) Math.round((hours - h) * 60);
        return h + "h" + (m > 0 ? m + "p" : "");
    }

    private void send(long chatId, String text) throws TelegramApiException {
        execute(SendMessage.builder().chatId(chatId).text(text).build());
    }

    private void sendMarkdown(long chatId, String text) throws TelegramApiException {
        execute(SendMessage.builder().chatId(chatId).text(text).parseMode("Markdown").build());
    }

    private void editMessage(long chatId, int messageId, String text) throws TelegramApiException {
        editMessage(chatId, messageId, text, "Markdown");
    }

    private void editMessage(long chatId, int messageId, String text, String parseMode) throws TelegramApiException {
        execute(EditMessageText.builder()
                .chatId(chatId)
                .messageId(messageId)
                .text(text)
                .parseMode(parseMode)
                .build());
    }

    // Nhân viên chỉ được xem chấm công / lương từ ngày 25 trở đi
    private boolean isEndOfMonth() {
        return LocalDate.now(VN_ZONE).getDayOfMonth() >= 25;
    }

    private boolean isAdmin(long telegramId) {
        if (adminIdsRaw == null || adminIdsRaw.isBlank()) return false;
        for (String id : adminIdsRaw.split(",")) {
            try {
                if (Long.parseLong(id.trim()) == telegramId) return true;
            } catch (NumberFormatException ignored) {}
        }
        return false;
    }

    private String formatDow(DayOfWeek dow) {
        return switch (dow) {
            case MONDAY -> "Thứ Hai";
            case TUESDAY -> "Thứ Ba";
            case WEDNESDAY -> "Thứ Tư";
            case THURSDAY -> "Thứ Năm";
            case FRIDAY -> "Thứ Sáu";
            case SATURDAY -> "Thứ Bảy";
            case SUNDAY -> "Chủ Nhật";
        };
    }

    private String formatVnd(double amount) {
        return String.format("%,.0f đ", amount);
    }
}
