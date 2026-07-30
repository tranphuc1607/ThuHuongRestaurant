package com.example.orderservice.entity.DTO.req;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class ScanReceiptRequest {

    // Hóa đơn viết tay có thể tràn sang nhiều tờ — mỗi phần tử là 1 trang, ảnh sẽ được gộp
    // vào cùng 1 lần gọi AI (nhiều image_url trong cùng message) để AI đọc và khớp món xuyên trang.
    @NotEmpty(message = "Cần ít nhất 1 ảnh hóa đơn")
    @Size(max = 10, message = "Tối đa 10 ảnh mỗi lần quét")
    private List<String> imagesBase64;

    private String mimeType = "image/jpeg";
}
