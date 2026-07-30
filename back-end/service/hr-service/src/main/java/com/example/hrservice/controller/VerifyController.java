package com.example.hrservice.controller;

import com.example.hrservice.entity.DTO.req.FaceCheckinRequest;
import com.example.hrservice.entity.DTO.res.AttendanceResponse;
import com.example.hrservice.entity.DTO.res.FaceCheckinResponse;
import com.example.hrservice.service.AttendanceService;
import com.example.hrservice.util.CheckinTokenUtil;
import com.example.restaurant_common.util.exception.MessageException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/hr")
@RequiredArgsConstructor
public class VerifyController {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter VN_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM/yyyy").withZone(VN_ZONE);

    private final AttendanceService attendanceService;
    private final CheckinTokenUtil checkinTokenUtil;

    @Value("${hr.wifi.allowed-ip}")
    private String allowedIp;

    /**
     * Endpoint công khai — nhân viên bấm nút trong Telegram → browser mở trang này.
     * Server check IP để xác minh WiFi nội bộ, sau đó ghi chấm công.
     * Trả về HTML (không qua FormRestResponse) vì method trả void và ghi trực tiếp vào response.
     */
    @GetMapping("/verify")
    public void verify(@RequestParam String token,
                       HttpServletRequest request,
                       HttpServletResponse response) throws IOException {

        response.setContentType("text/html;charset=UTF-8");
        PrintWriter writer = response.getWriter();

        String clientIp = getClientIp(request);
        log.info("[Verify] clientIp={}", clientIp);

        // Kiểm tra WiFi nội bộ
        if (!isAllowedIp(clientIp)) {
            writer.write(buildHtml("❌ Không đúng mạng nội bộ",
                    "Bạn đang dùng mạng ngoài.<br>Vui lòng kết nối WiFi nội bộ của nhà hàng và thử lại.",
                    "#e74c3c"));
            return;
        }

        // Xác thực token HMAC
        String[] fields;
        try {
            fields = checkinTokenUtil.validateToken(token);
        } catch (RuntimeException e) {
            writer.write(buildHtml("❌ Yêu cầu không hợp lệ", e.getMessage(), "#e74c3c"));
            return;
        }

        UUID employeeId = UUID.fromString(fields[0]);
        UUID shiftId = UUID.fromString(fields[1]);
        String type = fields[2]; // "IN" hoặc "OUT"

        try {
            if ("IN".equals(type)) {
                AttendanceResponse result = attendanceService.checkIn(employeeId, shiftId);
                String time = VN_FMT.format(result.getCheckInTime());
                String lateMsg = result.getLateMinutes() > 0
                        ? "<br>⚠️ Muộn " + result.getLateMinutes() + " phút"
                        : "<br>✅ Đúng giờ";
                writer.write(buildHtml("✅ Check-in thành công!",
                        "Ca: <b>" + escapeHtml(result.getShiftName()) + "</b><br>"
                        + "Giờ vào: <b>" + escapeHtml(time) + "</b>" + lateMsg,
                        "#27ae60"));
            } else {
                AttendanceResponse result = attendanceService.checkOut(employeeId, shiftId);
                String time = VN_FMT.format(result.getCheckOutTime());
                String hoursMsg = result.getTotalHours() != null
                        ? "<br>⏱️ Tổng: <b>" + result.getTotalHours() + " giờ</b>"
                        : "";
                writer.write(buildHtml("✅ Check-out thành công!",
                        "Ca: <b>" + escapeHtml(result.getShiftName()) + "</b><br>"
                        + "Giờ ra: <b>" + escapeHtml(time) + "</b>" + hoursMsg,
                        "#2980b9"));
            }
        } catch (Exception e) {
            writer.write(buildHtml("❌ Lỗi", escapeHtml(e.getMessage()), "#e74c3c"));
        }
    }

    private String getClientIp(HttpServletRequest request) {
        // Không tin tưởng X-Forwarded-For vì attacker có thể forge header để bypass WiFi check.
        return request.getRemoteAddr();
    }

    private boolean isAllowedIp(String clientIp) {
        if ("*".equals(allowedIp) || "ANY".equals(allowedIp)) return true;
        // Exact match
        if (clientIp.equals(allowedIp)) return true;
        // Wildcard subnet: "192.168.1.*" — so sánh từng octet, không dùng startsWith()
        // để tránh "192.168.1.1" vô tình match "192.168.1.100"
        if (allowedIp.endsWith(".*")) {
            String prefix = allowedIp.substring(0, allowedIp.length() - 2); // "192.168.1"
            String[] prefixParts = prefix.split("\\.");
            String[] clientParts = clientIp.split("\\.");
            if (clientParts.length < prefixParts.length) return false;
            for (int i = 0; i < prefixParts.length; i++) {
                if (!prefixParts[i].equals(clientParts[i])) return false;
            }
            return true;
        }
        return false;
    }

    private String escapeHtml(String input) {
        if (input == null) return "";
        return input.replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\"", "&quot;")
                    .replace("'", "&#x27;");
    }

    /**
     * Nhân viên chấm công qua nhận diện khuôn mặt trên website (điện thoại / máy tính).
     * Tự động nhận diện check-in hoặc check-out dựa trên ca làm hôm nay.
     */
    @PostMapping("/face-checkin")
    public ResponseEntity<FaceCheckinResponse> faceCheckin(
            @RequestBody FaceCheckinRequest req,
            HttpServletRequest request) throws MessageException {

        String clientIp = getClientIp(request);
        log.info("[FaceCheckin] clientIp={}, employeeId={}", clientIp, req.getEmployeeId());

        FaceCheckinResponse result = attendanceService.faceCheckIn(req.getEmployeeId());
        return ResponseEntity.ok(result);
    }

    private String buildHtml(String title, String message, String color) {
        return "<!DOCTYPE html><html lang='vi'><head><meta charset='UTF-8'>" +
               "<meta name='viewport' content='width=device-width,initial-scale=1'>" +
               "<title>" + title + "</title>" +
               "<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;" +
               "min-height:100vh;margin:0;background:#f5f5f5;}" +
               ".card{background:#fff;border-radius:12px;padding:32px 24px;text-align:center;" +
               "box-shadow:0 2px 12px rgba(0,0,0,.1);max-width:360px;width:90%;}" +
               ".icon{font-size:48px;margin-bottom:16px;}" +
               ".title{font-size:20px;font-weight:bold;color:" + color + ";margin-bottom:12px;}" +
               ".msg{font-size:15px;color:#444;line-height:1.6;}" +
               ".close{margin-top:24px;font-size:13px;color:#888;}"+
               "</style></head><body>" +
               "<div class='card'>" +
               "<div class='icon'>" + title.substring(0, 2) + "</div>" +
               "<div class='title'>" + title.substring(2).trim() + "</div>" +
               "<div class='msg'>" + message + "</div>" +
               "<div class='close'>Bạn có thể đóng trang này.</div>" +
               "</div></body></html>";
    }
}
