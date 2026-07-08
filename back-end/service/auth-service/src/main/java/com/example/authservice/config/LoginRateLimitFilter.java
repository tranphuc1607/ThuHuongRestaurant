package com.example.authservice.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn 10 lần login thất bại trong 15 phút từ cùng một IP.
 * Sau đó trả 429 và block cho đến khi hết window.
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_ATTEMPTS = 10;
    private static final long WINDOW_MS = 15 * 60 * 1000L; // 15 phút
    private static final int MAX_TRACKED_IPS = 10_000;

    // [ip] -> [attemptCount, windowStartMs]
    private final ConcurrentHashMap<String, long[]> attempts = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !("/api/v1/auth/login".equals(request.getServletPath())
                && "POST".equals(request.getMethod()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        long now = System.currentTimeMillis();

        // Dọn map khi quá lớn để tránh memory leak
        if (attempts.size() > MAX_TRACKED_IPS) {
            attempts.entrySet().removeIf(e -> now - e.getValue()[1] > WINDOW_MS);
        }

        long[] data = attempts.compute(ip, (k, v) -> {
            if (v == null || now - v[1] > WINDOW_MS) return new long[]{1, now};
            v[0]++;
            return v;
        });

        if (data[0] > MAX_ATTEMPTS) {
            long retryAfterSec = (WINDOW_MS - (now - data[1])) / 1000;
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
            response.setHeader("Retry-After", String.valueOf(retryAfterSec));
            response.getWriter().write(
                "{\"statusCode\":429,\"message\":\"Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau "
                + (retryAfterSec / 60 + 1) + " phút.\",\"data\":null,\"error\":\"Too Many Requests\"}"
            );
            return;
        }

        chain.doFilter(request, response);
    }
}
