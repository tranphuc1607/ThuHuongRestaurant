# Bộ đo độ chính xác quét hóa đơn

Đo bằng số liệu thay vì cảm nhận. Chạy trước/sau mỗi thay đổi để biết thay đổi đó giúp hay hại.

## Cách dùng

1. **Chụp ảnh hóa đơn viết tay thật** (càng nhiều nét chữ khác nhau càng tốt, nên có ~20–30 tờ).
2. Đặt ảnh vào `images/`, ví dụ `images/hd001.jpg`.
3. Tạo nhãn tương ứng `labels/hd001.json` — copy từ `labels/_example.json` rồi điền đúng nội dung **viết tay** trên tờ đó.
   - `productName` phải là **tên chuẩn trong thực đơn** (khớp chính xác), không phải chữ viết tắt trên giấy.
   - Nếu tờ đó không ghi bàn hoặc không có tổng cộng thì bỏ hẳn khóa đó ra.
4. Đảm bảo backend đang chạy (`docker compose ps` trong `back-end/`), rồi:

```powershell
cd back-end\service\order-service\eval
.\Run-ReceiptScanEval.ps1              # chạy tất cả
.\Run-ReceiptScanEval.ps1 -Only hd001  # chạy một ảnh
```

## Hai chỉ số cần nhìn

| Chỉ số | Nghĩa | Mục tiêu |
|---|---|---|
| **TU DONG DUNG** | % dòng đúng cả món + số lượng **và** rơi vào nhóm "Đã xác nhận" (nhân viên không phải sửa) | ≥ 95% |
| **DO CHUAN 'tu tin'** | Trong các dòng AI tự tin, bao nhiêu % thực sự đúng | ≥ 99% |

Dòng bị đánh **"Cần xác nhận" KHÔNG tính là lỗi** — đó là hệ thống nhắc nhân viên kiểm, đúng như thiết kế.
Lỗi thật sự đáng lo là **"sai âm thầm"** (`SaiAmTham`): AI tự tin nhưng sai, nhân viên sẽ không kiểm lại.
Nếu con số này > 0 thì phải sửa trước khi lo tới việc nâng tỷ lệ tự động đúng.

## Lưu ý quota

Mỗi ảnh tốn **1 lượt gọi Gemini**. Gói miễn phí chỉ ~100–250 lượt/ngày, nên chạy bộ 30 ảnh vài lần là chạm trần.
Dùng `-Only` khi chỉ cần thử nhanh một ca.

## Đổi model để so sánh

Model nằm trong config, không cần build lại:

```powershell
# back-end/.env
GEMINI_MODEL=gemini-3.5-flash-lite   # mặc định, ~2,4s
# GEMINI_MODEL=gemini-3.6-flash      # ~7,2s, model lớn hơn — thử nếu chữ viết tay bị đọc sai nhiều
```

Thời gian mỗi lần gọi nằm trong log: `docker compose logs order-service | grep ReceiptScan`
→ `Gemini model=... 2417 ms (budget=128) — prompt=2864 thoughts=0 output=178`

```powershell
cd back-end; docker compose up -d order-service
```

Chạy lại bộ đo trên **cùng bộ ảnh** rồi so hai con số ở trên — đó là cách chọn model có căn cứ.

## Về ảnh mẫu đang có

`images/form_receipt.jpg` là ảnh **tự tạo bằng chữ in** (font viết tay giả), dùng để kiểm tra bản thân bộ đo
chạy đúng. Nó **không đại diện cho chữ viết tay thật** — con số đo trên nó sẽ đẹp hơn thực tế nhiều.
Thay bằng ảnh thật trước khi kết luận về độ chính xác.
