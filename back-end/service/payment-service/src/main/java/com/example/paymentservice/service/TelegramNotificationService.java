package com.example.paymentservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelegramNotificationService {

    private static final String TELEGRAM_API = "https://api.telegram.org/bot";

    private final ObjectMapper objectMapper;

    @Value("${telegram.bot.token:}")
    private String botToken;

    @Value("${telegram.bot.chat-id:}")
    private String chatId;

    public void notify(String message) {
        if (botToken.isBlank() || chatId.isBlank()) {
            log.debug("Telegram chưa cấu hình — bỏ qua thông báo");
            return;
        }
        CompletableFuture.runAsync(() -> sendToTelegram(message));
    }

    private void sendToTelegram(String message) {
        try {
            String json = objectMapper.writeValueAsString(
                    Map.of("chat_id", chatId, "text", message, "parse_mode", "HTML"));

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(TELEGRAM_API + botToken + "/sendMessage"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();

            HttpResponse<String> response = HttpClient.newHttpClient()
                    .send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.warn("[Telegram] API trả về {}: {}", response.statusCode(), response.body());
            }
        } catch (Exception e) {
            log.error("[Telegram] Lỗi gửi thông báo: {}", e.getMessage());
        }
    }
}
