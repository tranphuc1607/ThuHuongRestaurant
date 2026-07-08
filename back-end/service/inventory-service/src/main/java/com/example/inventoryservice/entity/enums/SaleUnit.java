package com.example.inventoryservice.entity.enums;

import com.fasterxml.jackson.annotation.JsonAlias;

public enum SaleUnit {
    // Đơn vị bán / phục vụ
    @JsonAlias({"ly", "Ly", "cup"})
    CUP,        // Ly

    @JsonAlias({"chai", "Chai"})
    CHAI,       // Chai

    @JsonAlias({"phần", "Phần", "suất", "Suất", "portion"})
    PORTION,    // Phần

    @JsonAlias({"kg", "Kg", "kilogram", "Kilogram"})
    KG,         // Kilogram

    @JsonAlias({"cái", "Cái", "miếng", "Miếng", "lon", "Lon", "piece"})
    PIECE,      // Cái / Miếng

    @JsonAlias({"đĩa", "Đĩa", "dĩa", "Dĩa", "tô", "Tô", "bát", "Bát", "dish"})
    DISH,       // Dĩa / Bát

    // Đơn vị nhập kho (mua theo số lượng lớn)
    @JsonAlias({"thùng", "Thùng"})
    THUNG,      // Thùng (VD: 1 thùng = 24 chai bia)

    @JsonAlias({"bao", "Bao"})
    BAO,        // Bao (VD: bao gạo 50kg)

    @JsonAlias({"hộp", "Hộp", "hop"})
    HOP,        // Hộp (VD: hộp trứng 30 quả)

    @JsonAlias({"vỉ", "Vỉ", "vi"})
    VI,         // Vỉ (VD: vỉ trứng 10 quả)

    @JsonAlias({"bình", "Bình"})
    BINH,       // Bình (VD: bình gas, bình nước lớn)

    @JsonAlias({"gói", "Gói"})
    GOI         // Gói (VD: gói bột ngọt, gia vị)
}
