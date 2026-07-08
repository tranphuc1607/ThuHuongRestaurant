# Thu Hương Restaurant — Frontend Design Plan

> Tham khảo giao diện: [BigFood Theme - Sapo](https://themes.sapo.vn/demo/big-food)

## Tech Stack

- Next.js 15 (App Router, TypeScript)
- Tailwind CSS
- Axios
- Base URL: `NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1`

---

## Design System

### Màu sắc (Color Palette)

| Token           | Hex       | Dùng cho                                                   |
|-----------------|-----------|------------------------------------------------------------|
| `primary`       | `#C8973C` | Logo "HƯƠNG", giá sản phẩm, nav active, section header bg |
| `primary-dark`  | `#6B4226` | Section header phụ (DANH MỤC, BÁN CHẠY...)                |
| `accent-green`  | `#3CB371` | Top announcement bar                                       |
| `bg-cream`      | `#FFF8F0` | Footer background, page background                        |
| `sale-price`    | `#E85D04` | Giá sale (màu cam/đỏ)                                     |
| `text-main`     | `#1A1A1A` | Nội dung chính                                            |
| `text-muted`    | `#888888` | Giá gốc bị gạch, text phụ                                |

### Typography

- Logo: `"THU"` bold đen + `"HƯƠNG"` gold, bordered box
- Nav: uppercase, letter-spacing
- Section header: uppercase trắng trên nền `primary-dark`
- Giá sản phẩm: `text-primary font-semibold`
- Giá cũ (bị gạch): `line-through text-muted`

### Spacing

- Container max-width: `1200px`, centered
- Section padding: `py-10 px-4`
- Card gap: `gap-4`
- Sidebar width: `~270px`

---

## Routes (App Router)

| Route                      | Trang                  | Auth  | API Backend                           |
|----------------------------|------------------------|-------|---------------------------------------|
| `/`                        | Trang chủ              | None  | `GET /products`                       |
| `/gioi-thieu`              | Giới thiệu             | None  | Static                                |
| `/san-pham`                | Tất cả sản phẩm        | None  | `GET /products?page=&size=`           |
| `/san-pham/[id]`           | Chi tiết sản phẩm      | None  | `GET /products/{id}`                  |
| `/khuyen-mai`              | Khuyến mãi             | None  | `GET /products` (filter)              |
| `/tin-tuc`                 | Tin tức                | None  | Static                                |
| `/lien-he`                 | Liên hệ                | None  | Static + form                         |
| `/dat-ban`                 | Đặt bàn                | None  | `POST /bookings`                      |
| `/dat-ban/[bookingCode]`   | Tra cứu booking        | None  | `GET /bookings/{bookingCode}`         |
| `/tai-khoan/dang-nhap`     | Đăng nhập              | Guest | `POST /auth/login`                    |
| `/tai-khoan/dang-ky`       | Đăng ký                | Guest | `POST /auth/register`                 |
| `/tai-khoan`               | Thông tin tài khoản    | User  | `GET /users/me`                       |

---

## Folder Structure

```
front-end/src/
├── app/
│   ├── layout.tsx                    ← RootLayout: TopBar + Header + Navbar + Footer
│   ├── page.tsx                      ← Trang chủ
│   ├── gioi-thieu/page.tsx
│   ├── san-pham/
│   │   ├── page.tsx                  ← Listing tất cả sản phẩm
│   │   └── [id]/page.tsx             ← Chi tiết sản phẩm
│   ├── khuyen-mai/page.tsx
│   ├── tin-tuc/page.tsx
│   ├── lien-he/page.tsx
│   ├── dat-ban/
│   │   ├── page.tsx                  ← Form đặt bàn
│   │   └── [bookingCode]/page.tsx    ← Tra cứu trạng thái booking
│   └── tai-khoan/
│       ├── dang-nhap/page.tsx
│       ├── dang-ky/page.tsx
│       └── page.tsx
├── components/
│   ├── layout/
│   │   ├── TopBar.tsx                ← Green bar: chào mừng + quick nav
│   │   ├── Header.tsx                ← Logo + Open/Email/Hotline
│   │   ├── Navbar.tsx                ← Main nav + Search + Cart icon
│   │   └── Footer.tsx                ← 5-column footer + social + payment icons
│   ├── home/
│   │   ├── HeroSlider.tsx            ← Full-width hero + prev/next + dots
│   │   ├── CategoryBanner.tsx        ← 2 card danh mục với image overlay
│   │   └── ProductSection.tsx        ← Section header + 3-col product grid
│   ├── product/
│   │   ├── ProductCard.tsx           ← Ảnh + giá + tên + star rating
│   │   ├── ProductGrid.tsx           ← 3-col responsive grid
│   │   ├── ProductList.tsx           ← List view (toggle)
│   │   └── ProductSidebar.tsx        ← Danh mục + nổi bật + promo sidebar
│   ├── ui/
│   │   ├── SectionHeader.tsx         ← Brown header + optional ◀▶ arrows
│   │   ├── PromoBanner.tsx           ← Banner khuyến mãi: ảnh + text + CTA
│   │   ├── Breadcrumb.tsx
│   │   ├── Pagination.tsx
│   │   ├── StarRating.tsx
│   │   └── PriceDisplay.tsx          ← Giá thường + giá sale
│   └── booking/
│       ├── BookingForm.tsx
│       └── BookingStatus.tsx
└── lib/
    ├── api.ts                        ← Axios instance
    ├── types.ts                      ← TypeScript interfaces
    └── utils.ts                      ← formatPrice, formatDate, ...
```

---

## Components Chi Tiết

### TopBar
```
[Nền xanh #3CB371]  "Chào mừng bạn đến với Thu Hương!"  |  Trang chủ  Giới thiệu  ...  |  Tài khoản ▼
```

### Header
```
[Logo: THU HƯƠNG bordered]    [🕐 OPEN: 08:00–22:00]  [✉ EMAIL: ...]  [📞 HOTLINE: ...]
```

### Navbar
```
TRANG CHỦ  |  GIỚI THIỆU  |  THỰC ĐƠN ▼  |  ĐẶT BÀN  |  TIN TỨC  |  LIÊN HỆ    [🔍] [🛒 0]
```

### ProductCard
```
┌──────────────────┐
│   [Ảnh món ăn]   │
├──────────────────┤
│ 80.000đ  ~~100k~~│  ← primary + line-through
│ Tên sản phẩm     │
│ ⭐⭐⭐⭐⭐ (12)  │
└──────────────────┘
```

### SectionHeader
```
┌─────────────────────────────────────────────────┐
│  SẢN PHẨM NỔI BẬT                          ◀ ▶  │  ← nền #6B4226, chữ trắng
└─────────────────────────────────────────────────┘
```

### Footer (5 cột)
```
VỀ CHÚNG TÔI   ĐIỀU KHOẢN   HƯỚNG DẪN   CHÍNH SÁCH   ĐĂNG KÍ NHẬN TIN
Trang chủ       Trang chủ    Trang chủ   Trang chủ    [email...........] [→]
Giới thiệu      ...          ...         ...
Thực đơn                                              [FB] [TW] [IG] [YT]
Đặt bàn

              CỬA HÀNG THU HƯƠNG
              Địa chỉ: ... | Điện thoại: ... | Email: ...

© 2024 Thu Hương Restaurant                    [VISA] [MasterCard]
```

---

## Trang Chủ — Sections (thứ tự từ trên xuống)

1. **TopBar** — green bar thông báo
2. **Header** — logo + 3 thông tin liên hệ (Open, Email, Hotline)
3. **Navbar** — điều hướng + search + cart
4. **HeroSlider** — full-width ~400px, text overlay "Nhà hàng Thu Hương" + subtitle + CTA "Xem thực đơn", prev/next arrows, dots
5. **CategoryBanner** — 2 card ngang (Món chính / Tráng miệng), image với text overlay kiểu script
6. **Layout 2 cột** (container):
   - **Sidebar trái (~270px)**:
     - "DANH MỤC SẢN PHẨM" → danh sách category từ API
     - "SẢN PHẨM BÁN CHẠY" → 4 sản phẩm list (ảnh nhỏ + tên + giá)
     - "SẢN PHẨM KHUYẾN MÃI" → 4 sản phẩm list
   - **Main content**:
     - Section "SẢN PHẨM NỔI BẬT" — 3-col × 2 row = 6 sản phẩm + arrows
     - PromoBanner "Khuyến mãi cực lớn -50%"
     - Section "SẢN PHẨM MỚI" — 3-col × 2 row = 6 sản phẩm
     - PromoBanner "Mua 1 tặng 2 / Giảm 50%"
     - Section "BÁN CHẠY TRONG TUẦN" — 3-col × 1 row = 3 sản phẩm
7. **BrandCarousel** — logo đối tác, auto-scroll
8. **Footer**

---

## Trang Sản Phẩm (`/san-pham`)

- Hero banner nhỏ: "Tất cả sản phẩm" trên nền ảnh mờ
- Breadcrumb: `Trang chủ / Tất cả sản phẩm`
- Layout 2 cột:
  - **Sidebar**: Danh mục + Nổi bật + Khuyến mãi + Promo banner
  - **Main**: Sort dropdown + Grid/List toggle + 3-col product grid + Pagination

---

## Trang Đặt Bàn (`/dat-ban`)

Form kết nối `POST /api/v1/bookings`:

```
Họ và tên *          [________________________]
Số điện thoại *      [________________________]
Email                [________________________]
Số lượng khách *     [  2  ] người
Ngày giờ đến *       [date] [time]   ← min: now+1h, range: 08:00–22:00
Ghi chú              [________________________]

Phương thức thanh toán:
◉ Chuyển khoản ngân hàng    ○ Tiền mặt khi đến

                    [  ĐẶT BÀN NGAY  ]
```

Sau khi tạo thành công:
- Redirect → `/dat-ban/{bookingCode}`
- Hiển thị: trạng thái PENDING_PAYMENT + thông tin booking
- Nếu BANK_TRANSFER: hiển thị QR VietQR + số tiền cọc + nội dung chuyển khoản `TH{paymentId}`

---

## API Integration (`src/lib/api.ts`)

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // cho refresh token cookie
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

---

## TypeScript Types (`src/lib/types.ts`)

```typescript
export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  status: 'ACTIVE' | 'INACTIVE';
  description?: string;
}

export interface Booking {
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  scheduledTime: string;   // ISO-8601 UTC
  guestCount: number;
  status: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  paymentMethod: 'BANK_TRANSFER' | 'CASH';
  depositAmount?: number;
  note?: string;
}

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  error: string | null;
}
```

---

## Tailwind Config — Custom Colors (`tailwind.config.ts`)

```typescript
theme: {
  extend: {
    colors: {
      primary:        '#C8973C',
      'primary-dark': '#6B4226',
      'accent-green': '#3CB371',
      'bg-cream':     '#FFF8F0',
      'sale-price':   '#E85D04',
    }
  }
}
```

---

## Thứ tự xây dựng (Build Order)

| Bước | Việc cần làm                                                    |
|------|-----------------------------------------------------------------|
| 1    | Tailwind config + design tokens                                 |
| 2    | Layout shell: TopBar + Header + Navbar + Footer                 |
| 3    | UI atoms: SectionHeader, PriceDisplay, StarRating, Breadcrumb  |
| 4    | ProductCard + ProductGrid                                       |
| 5    | Trang chủ: HeroSlider + CategoryBanner + ProductSection         |
| 6    | Trang sản phẩm: listing + sidebar + pagination                  |
| 7    | Trang chi tiết sản phẩm                                        |
| 8    | Trang đặt bàn + tra cứu booking                                |
| 9    | Auth: đăng nhập + đăng ký + tài khoản                         |
| 10   | Trang tĩnh: Giới thiệu + Liên hệ + Tin tức                    |
