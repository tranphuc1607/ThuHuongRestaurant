package com.example.inventoryservice.config;

import com.example.restaurant_common.entity.DTO.res.RestResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class InventoryExceptionHandler {

    // BUG-2: query param enum không hợp lệ (VD: ?reason=INVALID) → 500 → fix 400
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<RestResponse<Object>> handleEnumMismatch(MethodArgumentTypeMismatchException ex) {
        String msg = String.format("Giá trị không hợp lệ cho tham số '%s': %s", ex.getName(), ex.getValue());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            RestResponse.<Object>builder()
                .statusCode(HttpStatus.BAD_REQUEST.value())
                .error(msg)
                .message("Bad Request")
                .build()
        );
    }

    // BUG-3 & BUG-4: JSON body có enum không hợp lệ (VD: saleUnit "INVALID" hoặc "phần" lỗi encode) → 500 → fix 400
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<RestResponse<Object>> handleMessageNotReadable(HttpMessageNotReadableException ex) {
        String msg = "Dữ liệu đầu vào không hợp lệ. Kiểm tra lại giá trị saleUnit/reason (phải là enum value: PORTION, CUP, DISH...)";
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
            RestResponse.<Object>builder()
                .statusCode(HttpStatus.BAD_REQUEST.value())
                .error(msg)
                .message("Bad Request")
                .build()
        );
    }
}
