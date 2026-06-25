package com.example.orderservice.bot;

import com.example.orderservice.entity.Booking;
import com.example.orderservice.entity.enums.BookingPaymentMethod;
import com.example.orderservice.entity.enums.BookingStatus;
import com.example.orderservice.repository.BookingRepository;
import com.example.orderservice.service.BookingService;
import com.example.restaurant_common.util.exception.MessageException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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
import java.util.List;

@Slf4j
@Component
public class BookingAdminBot extends TelegramLongPollingBot {

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DT_FMT = DateTimeFormatter.ofPattern("HH:mm dd/MM").withZone(VN_ZONE);

    @Value("${booking.telegram.bot.token:}")
    private String botToken;

    @Value("${booking.telegram.bot.username:}")
    private String botUsername;

    @Value("${booking.telegram.admin-ids:}")
    private String adminIdsRaw;

    private final BookingRepository bookingRepository;

    // @Lazy để tránh circular dependency: BookingService → BookingAdminBot → BookingService
    @Autowired
    @Lazy
    private BookingService bookingService;

    public BookingAdminBot(BookingRepository bookingRepository) {
        this.bookingRepository = bookingRepository;
    }

    @Override public String getBotToken() { return botToken; }
    @Override public String getBotUsername() { return botUsername; }

    @Override
    public void onUpdateReceived(Update update) {
        try {
            if (update.hasMessage() && update.getMessage().hasText()) {
                handleMessage(update);
            } else if (update.hasCallbackQuery()) {
                handleCallback(update);
            }
        } catch (Exception e) {
            log.error("[Booking Bot] Lỗi xử lý update: {}", e.getMessage(), e);
        }
    }

    // ── Message handlers ────────────────────────────────────────────────────

    private void handleMessage(Update update) throws TelegramApiException {
        long chatId = update.getMessage().getChatId();
        long telegramId = update.getMessage().getFrom().getId();
        String text = update.getMessage().getText().trim();

        if (!isAdmin(telegramId)) {
            send(chatId, "❌ Bot này chỉ dành cho quản lý nhà hàng.");
            return;
        }

        switch (text.split(" ")[0].toLowerCase()) {
            case "/start"   -> handleStart(chatId);
            case "/pending" -> handlePending(chatId);
            case "/today"   -> handleToday(chatId);
            default         -> send(chatId, "Lệnh không hợp lệ. Gõ /start để xem danh sách.");
        }
    }

    private void handleStart(long chatId) throws TelegramApiException {
        sendMd(chatId,
                "📅 *Booking Admin Bot — Nhà hàng Thư Hương*\n\n" +
                "/pending — Danh sách booking chờ thanh toán\n" +
                "/today — Lịch đặt bàn hôm nay");
    }

    private void handlePending(long chatId) throws TelegramApiException {
        List<Booking> list = bookingRepository.findByStatus(
                BookingStatus.PENDING_PAYMENT,
                PageRequest.of(0, 10, Sort.by("createdAt").descending())
        ).getContent();

        if (list.isEmpty()) {
            send(chatId, "✅ Không có booking nào đang chờ xác nhận.");
            return;
        }

        sendMd(chatId, "📋 *Booking chờ thanh toán (" + list.size() + "):*");
        for (Booking b : list) {
            sendBookingCard(chatId, b, true);
        }
    }

    private void handleToday(long chatId) throws TelegramApiException {
        Instant todayStart = LocalDate.now(VN_ZONE).atStartOfDay(VN_ZONE).toInstant();
        Instant todayEnd   = LocalDate.now(VN_ZONE).plusDays(1).atStartOfDay(VN_ZONE).toInstant();

        List<Booking> list = bookingRepository.findByScheduledTimeBetween(
                todayStart, todayEnd,
                PageRequest.of(0, 20, Sort.by("scheduledTime").ascending())
        ).getContent().stream()
                .filter(b -> b.getStatus() != BookingStatus.EXPIRED
                          && b.getStatus() != BookingStatus.CANCELLED)
                .toList();

        if (list.isEmpty()) {
            send(chatId, "📅 Hôm nay chưa có booking nào.");
            return;
        }

        sendMd(chatId, "📅 *Lịch đặt bàn hôm nay (" + list.size() + "):*");
        for (Booking b : list) {
            sendBookingCard(chatId, b, b.getStatus() == BookingStatus.PENDING_PAYMENT);
        }
    }

    // ── Callback handlers ───────────────────────────────────────────────────

    private void handleCallback(Update update) {
        long chatId = update.getCallbackQuery().getMessage().getChatId();
        long telegramId = update.getCallbackQuery().getFrom().getId();
        String callbackQueryId = update.getCallbackQuery().getId();
        String data = update.getCallbackQuery().getData();
        int messageId = update.getCallbackQuery().getMessage().getMessageId();

        try {
            if (!isAdmin(telegramId)) {
                execute(AnswerCallbackQuery.builder()
                        .callbackQueryId(callbackQueryId)
                        .text("❌ Không có quyền").showAlert(true).build());
                return;
            }

            if (data.startsWith("CONFIRM_BOOKING:")) {
                Long id = Long.parseLong(data.split(":")[1]);
                handleConfirmBooking(chatId, messageId, id);
            } else if (data.startsWith("CANCEL_BOOKING:")) {
                Long id = Long.parseLong(data.split(":")[1]);
                handleCancelBooking(chatId, messageId, id);
            }
        } catch (Exception e) {
            log.error("[Booking Bot] Lỗi callback '{}': {}", data, e.getMessage(), e);
        } finally {
            try {
                execute(AnswerCallbackQuery.builder().callbackQueryId(callbackQueryId).build());
            } catch (TelegramApiException ignored) {}
        }
    }

    private void handleConfirmBooking(long chatId, int messageId, Long bookingId) throws Exception {
        try {
            bookingService.confirmBooking(bookingId, "ADMIN_BOT");
            Booking b = bookingRepository.findById(bookingId).orElse(null);
            String info = b != null ? "\n📋 " + b.getBookingCode() + " — " + b.getCustomerName() : "";
            editMd(chatId, messageId, "✅ *Đã xác nhận booking*" + info +
                    "\n_Kho đã trừ. Nhắc nhở sẽ gửi trước 1 tiếng._");
        } catch (MessageException e) {
            editMd(chatId, messageId, "❌ " + e.getMessage());
        }
    }

    private void handleCancelBooking(long chatId, int messageId, Long bookingId) throws Exception {
        try {
            bookingService.cancelBooking(bookingId, "ADMIN_BOT", "Hủy bởi quản lý qua Telegram");
            Booking b = bookingRepository.findById(bookingId).orElse(null);
            String info = b != null ? "\n📋 " + b.getBookingCode() + " — " + b.getCustomerName() : "";
            editMd(chatId, messageId, "❌ *Đã hủy booking*" + info);
        } catch (MessageException e) {
            editMd(chatId, messageId, "❌ " + e.getMessage());
        }
    }

    // ── Push notification methods (gọi từ BookingService) ───────────────────

    public void notifyConfirmed(Booking b, String confirmedBy) {
        if (!isConfigured()) return;
        boolean isCash = BookingPaymentMethod.CASH.equals(b.getPaymentMethod());
        String header = isCash ? "✅ *Booking xác nhận — Thanh toán tiền mặt*"
                               : "✅ *Booking đã được xác nhận*";
        String payNote = isCash ? "\n💵 _Khách thanh toán tiền mặt khi đến ăn_"
                                : "\n💳 _Chuyển khoản trước_";
        String text = buildBookingText(header, b) + payNote +
                "\n_Xác nhận bởi: " + confirmedBy + "_";
        broadcastToAdmins(text, null);
    }

    public void notifyAutoConfirmed(Booking b) {
        if (!isConfigured()) return;
        String text = buildBookingText("💳 *Booking xác nhận qua chuyển khoản*", b) +
                "\n_Đã tự động xác nhận & trừ kho._";
        broadcastToAdmins(text, null);
    }

    public void notifyReminder(Booking b) {
        if (!isConfigured()) return;
        String text = buildBookingText("⏰ *Nhắc nhở — 1 tiếng nữa có khách!*", b);
        broadcastToAdmins(text, null);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void sendBookingCard(long chatId, Booking b, boolean withActionButtons) throws TelegramApiException {
        String statusLabel = statusEmoji(b.getStatus()) + " " + b.getStatus().name();
        String text = buildBookingText(statusLabel, b);

        if (withActionButtons) {
            execute(SendMessage.builder().chatId(chatId).text(text).parseMode("Markdown")
                    .replyMarkup(InlineKeyboardMarkup.builder()
                            .keyboardRow(List.of(
                                    InlineKeyboardButton.builder()
                                            .text("✅ Xác nhận").callbackData("CONFIRM_BOOKING:" + b.getId()).build(),
                                    InlineKeyboardButton.builder()
                                            .text("❌ Hủy").callbackData("CANCEL_BOOKING:" + b.getId()).build()
                            )).build())
                    .build());
        } else {
            sendMd(chatId, text);
        }
    }

    private String buildBookingText(String header, Booking b) {
        String payMethod = b.getPaymentMethod() == null ? ""
                : BookingPaymentMethod.CASH.equals(b.getPaymentMethod()) ? " 💵 Tiền mặt"
                : " 💳 Chuyển khoản";
        return header + "\n\n" +
                "📋 " + b.getBookingCode() + "\n" +
                "👤 " + b.getCustomerName() + " | 📞 " + b.getCustomerPhone() + "\n" +
                "🍽 Bàn: " + (b.getDiningTable() != null ? b.getDiningTable().getName() : "Chưa chọn") + "\n" +
                "⏰ " + DT_FMT.format(b.getScheduledTime()) + "\n" +
                "💰 " + String.format("%,.0f đ", b.getTotalAmount()) + payMethod +
                (b.getNote() != null && !b.getNote().isBlank() ? "\n📝 " + b.getNote() : "");
    }

    private String statusEmoji(BookingStatus status) {
        return switch (status) {
            case PENDING_PAYMENT -> "⏳";
            case CONFIRMED       -> "✅";
            case CHECKED_IN      -> "🪑";
            case COMPLETED       -> "🏁";
            case CANCELLED       -> "❌";
            case EXPIRED         -> "⏰";
        };
    }

    private void broadcastToAdmins(String text, InlineKeyboardMarkup keyboard) {
        if (adminIdsRaw == null || adminIdsRaw.isBlank()) return;
        for (String adminIdStr : adminIdsRaw.split(",")) {
            try {
                long adminId = Long.parseLong(adminIdStr.trim());
                SendMessage.SendMessageBuilder builder = SendMessage.builder()
                        .chatId(adminId).text(text).parseMode("Markdown");
                if (keyboard != null) builder.replyMarkup(keyboard);
                execute(builder.build());
            } catch (Exception e) {
                log.error("[Booking Bot] Lỗi gửi thông báo đến admin {}: {}", adminIdStr, e.getMessage());
            }
        }
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

    private boolean isConfigured() {
        return botToken != null && !botToken.isBlank();
    }

    private void send(long chatId, String text) throws TelegramApiException {
        execute(SendMessage.builder().chatId(chatId).text(text).build());
    }

    private void sendMd(long chatId, String text) throws TelegramApiException {
        execute(SendMessage.builder().chatId(chatId).text(text).parseMode("Markdown").build());
    }

    private void editMd(long chatId, int messageId, String text) throws TelegramApiException {
        execute(EditMessageText.builder().chatId(chatId).messageId(messageId)
                .text(text).parseMode("Markdown").build());
    }
}
