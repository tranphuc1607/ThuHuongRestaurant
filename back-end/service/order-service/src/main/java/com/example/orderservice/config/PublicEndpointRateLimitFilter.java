package com.example.orderservice.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limit các public booking/payment endpoints để ngăn enumeration và spam.
 * 30 request/phút per IP cho mỗi endpoint nhóm public.
 */
@Component
public class PublicEndpointRateLimitFilter extends OncePerRequestFilter {

    private static final int MAX_REQ_PER_WINDOW = 30;
    private static final long WINDOW_MS = 60 * 1000L; // 1 phút
    private static final int MAX_TRACKED_IPS = 10_000;

    private static final List<String> RATE_LIMITED_PREFIXES = List.of(
            "/api/v1/bookings",
            "/api/v1/orders/table"
    );

    private final ConcurrentHashMap<String, long[]> counters = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getServletPath();
        return RATE_LIMITED_PREFIXES.stream().noneMatch(path::startsWith);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String ip = request.getRemoteAddr();
        long now = System.currentTimeMillis();

        if (counters.size() > MAX_TRACKED_IPS) {
            counters.entrySet().removeIf(e -> now - e.getValue()[1] > WINDOW_MS);
        }

        long[] data = counters.compute(ip, (k, v) -> {
            if (v == null || now - v[1] > WINDOW_MS) return new long[]{1, now};
            v[0]++;
            return v;
        });

        if (data[0] > MAX_REQ_PER_WINDOW) {
            response.setStatus(429);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8");
            response.setHeader("Retry-After", "60");
            response.getWriter().write(
                "{\"statusCode\":429,\"message\":\"Quá nhiều yêu cầu. Vui lòng thử lại sau 1 phút.\",\"data\":null,\"error\":\"Too Many Requests\"}"
            );
            return;
        }

        chain.doFilter(request, response);
    }
}
