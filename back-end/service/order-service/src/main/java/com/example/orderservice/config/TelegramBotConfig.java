package com.example.orderservice.config;

import com.example.orderservice.bot.BookingAdminBot;
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

    private final BookingAdminBot bookingAdminBot;

    @EventListener(ApplicationReadyEvent.class)
    public void registerBot() {
        if (bookingAdminBot.getBotToken() == null || bookingAdminBot.getBotToken().isBlank()) {
            log.warn("[Booking Bot] Token chua duoc cau hinh — bot khong duoc khoi dong. Set BOOKING_TELEGRAM_BOT_TOKEN de kich hoat.");
            return;
        }
        try {
            TelegramBotsApi telegramBotsApi = new TelegramBotsApi(DefaultBotSession.class);
            telegramBotsApi.registerBot(bookingAdminBot);
            log.info("[Booking Bot] Bot '{}' da duoc dang ky thanh cong.", bookingAdminBot.getBotUsername());
        } catch (TelegramApiException e) {
            log.error("[Booking Bot] Khong the dang ky bot: {}", e.getMessage());
        }
    }
}
