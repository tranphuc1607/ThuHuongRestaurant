package com.example.api_gateway.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebExceptionHandler;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@Order(-2)
@RequiredArgsConstructor
public class GlobalGatewayErrorHandler implements WebExceptionHandler {

    private final ObjectMapper objectMapper;

    @Override
    @SuppressWarnings({"null", "NullableProblems"})
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        HttpStatus status;
        String message;

        if (ex instanceof ResponseStatusException rse) {
            status = HttpStatus.resolve(rse.getStatusCode().value());
            if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
            message = rse.getReason() != null ? rse.getReason() : resolveDefaultMessage(status);
        } else {
            status = HttpStatus.SERVICE_UNAVAILABLE;
            message = "Service tạm thời không khả dụng, vui lòng thử lại sau";
            log.error("[Gateway] Lỗi không xử lý được từ {}: {} — {}",
                    exchange.getRequest().getPath(),
                    ex.getClass().getSimpleName(),
                    ex.getMessage());
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("statusCode", status.value());
        body.put("message", message);
        body.put("data", null);
        body.put("error", status.getReasonPhrase());

        byte[] bytes;
        try {
            bytes = objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException e) {
            bytes = ("{\"statusCode\":" + status.value() + ",\"message\":\"" + message + "\",\"data\":null}")
                    .getBytes(StandardCharsets.UTF_8);
        }

        exchange.getResponse().setStatusCode(status);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buffer = exchange.getResponse().bufferFactory().wrap(bytes);
        return exchange.getResponse().writeWith(Mono.just(buffer));
    }

    private String resolveDefaultMessage(HttpStatus status) {
        return switch (status) {
            case UNAUTHORIZED -> "Bạn chưa đăng nhập hoặc token đã hết hạn";
            case FORBIDDEN -> "Bạn không có quyền thực hiện thao tác này";
            case NOT_FOUND -> "Không tìm thấy tài nguyên yêu cầu";
            case SERVICE_UNAVAILABLE -> "Service tạm thời không khả dụng, vui lòng thử lại sau";
            default -> status.getReasonPhrase();
        };
    }
}
