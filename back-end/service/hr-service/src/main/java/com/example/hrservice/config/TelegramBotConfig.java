package com.example.hrservice.config;

import com.example.hrservice.bot.HRTelegramBot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class TelegramBotConfig {

    private final HRTelegramBot hrTelegramBot;

    @EventListener(ApplicationReadyEvent.class)
    public void registerBot() {
        if (hrTelegramBot.getBotToken() == null || hrTelegramBot.getBotToken().isBlank()) {
            log.warn("[HR Bot] Token chua duoc cau hinh — bot khong duoc khoi dong. Set HR_TELEGRAM_BOT_TOKEN de kich hoat.");
            return;
        }
        try {
            TelegramBotsApi telegramBotsApi = new TelegramBotsApi(DefaultBotSession.class);
            telegramBotsApi.registerBot(hrTelegramBot);
            log.info("[HR Bot] Bot '{}' da duoc dang ky thanh cong.", hrTelegramBot.getBotUsername());
        } catch (TelegramApiException e) {
            log.error("[HR Bot] Khong the dang ky bot: {}", e.getMessage());
        }
    }
}
