package com.example.orderservice.entity.DTO.res;

import com.example.orderservice.entity.Booking;
import com.example.orderservice.entity.enums.BookingPaymentMethod;
import com.example.orderservice.entity.enums.BookingStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
public class BookingResponse {

    private Long id;
    private String bookingCode;
    private String customerName;
    private String customerPhone;
    private String customerBankAccount;
    private Long tableId;
    private String tableName;
    private Instant scheduledTime;
    private Integer guestCount;
    private BookingStatus status;
    private Double totalAmount;
    private Double paidAmount;
    private String stockWarning;
    private String cancelReason;
    private String note;
    private BookingPaymentMethod paymentMethod;
    private List<BookingItemResponse> items;
    private Instant createdAt;
    private PaymentInfoResponse paymentInfo;
    private Instant expiresAt;

    public static BookingResponse from(Booking b) {
        return BookingResponse.builder()
                .id(b.getId())
                .bookingCode(b.getBookingCode())
                .customerName(b.getCustomerName())
                .customerPhone(b.getCustomerPhone())
                .customerBankAccount(b.getCustomerBankAccount())
                .tableId(b.getDiningTable() != null ? b.getDiningTable().getId() : null)
                .tableName(b.getDiningTable() != null ? b.getDiningTable().getName() : null)
                .scheduledTime(b.getScheduledTime())
                .guestCount(b.getGuestCount())
                .status(b.getStatus())
                .totalAmount(b.getTotalAmount())
                .paidAmount(b.getPaidAmount())
                .stockWarning(b.getStockWarning())
                .cancelReason(b.getCancelReason())
                .note(b.getNote())
                .paymentMethod(b.getPaymentMethod())
                .items(b.getItems().stream().map(BookingItemResponse::from).collect(Collectors.toList()))
                .createdAt(b.getCreatedAt())
                .build();
    }

    public static BookingResponse fromWithPayment(Booking b, PaymentInfoResponse paymentInfo) {
        BookingResponse res = from(b);
        res.setPaymentInfo(paymentInfo);
        res.setExpiresAt(b.getCreatedAt().plusSeconds(30 * 60));
        return res;
    }
}
