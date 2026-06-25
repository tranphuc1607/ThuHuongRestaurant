package com.example.inventoryservice.entity.enums;

public enum SaleUnit {
    // Đơn vị bán / phục vụ
    CUP,        // Ly
    CHAI,       // Chai
    PORTION,    // Phần
    KG,         // Kilogram
    PIECE,      // Cái / Miếng
    DISH,       // Dĩa / Bát

    // Đơn vị nhập kho (mua theo số lượng lớn)
    THUNG,      // Thùng (VD: 1 thùng = 24 chai bia)
    BAO,        // Bao (VD: bao gạo 50kg)
    HOP,        // Hộp (VD: hộp trứng 30 quả)
    VI,         // Vỉ (VD: vỉ trứng 10 quả)
    BINH,       // Bình (VD: bình gas, bình nước lớn)
    GOI         // Gói (VD: gói bột ngọt, gia vị)
}
