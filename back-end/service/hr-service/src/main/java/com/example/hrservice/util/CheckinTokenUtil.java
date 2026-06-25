package com.example.hrservice.util;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

@Component
public class CheckinTokenUtil {

    private static final long TOKEN_EXPIRY_MS = 5 * 60 * 1000L; // 5 phút

    @Value("${hr.telegram.checkin-secret}")
    private String secret;

    @Value("${hr.server.public-url}")
    private String serverPublicUrl;

    /**
     * Sinh token HMAC-SHA256 tự chứa expiry (không cần Redis).
     * Format: Base64Url(payload) + "." + Base64Url(HMAC)
     * Payload: "employeeId:shiftId:type:issuedAtMillis"
     */
    public String generateToken(Long employeeId, Long shiftId, String type) {
        String payload = employeeId + ":" + shiftId + ":" + type + ":" + Instant.now().toEpochMilli();
        String encodedPayload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payload.getBytes(StandardCharsets.UTF_8));
        String signature = computeHmac(payload);
        return encodedPayload + "." + signature;
    }

    /**
     * Sinh URL nút bấm xác nhận check-in/out.
     */
    public String generateVerifyUrl(Long employeeId, Long shiftId, String type) {
        String token = generateToken(employeeId, shiftId, type);
        return serverPublicUrl + "/api/v1/hr/verify?token=" + token;
    }

    /**
     * Xác thực token. Trả về mảng [employeeId, shiftId, type].
     * Ném RuntimeException nếu token không hợp lệ hoặc hết hạn.
     */
    public String[] validateToken(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 2) {
            throw new RuntimeException("Token không hợp lệ");
        }
        String encodedPayload = parts[0];
        String signature = parts[1];

        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(encodedPayload), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Token không hợp lệ");
        }

        // Xác minh chữ ký
        String expectedSig = computeHmac(payload);
        if (!expectedSig.equals(signature)) {
            throw new RuntimeException("Chữ ký token không hợp lệ");
        }

        // Parse payload: "employeeId:shiftId:type:issuedAtMillis"
        String[] fields = payload.split(":");
        if (fields.length != 4) {
            throw new RuntimeException("Token không hợp lệ");
        }

        // Kiểm tra hết hạn
        long issuedAt = Long.parseLong(fields[3]);
        if (Instant.now().toEpochMilli() - issuedAt > TOKEN_EXPIRY_MS) {
            throw new RuntimeException("Yêu cầu đã hết hạn (5 phút). Vui lòng gõ /checkin hoặc /checkout lại.");
        }

        return new String[]{fields[0], fields[1], fields[2]}; // [employeeId, shiftId, type]
    }

    private String computeHmac(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(keySpec);
            byte[] hmacBytes = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hmacBytes);
        } catch (Exception e) {
            throw new RuntimeException("Lỗi tạo token", e);
        }
    }
}
