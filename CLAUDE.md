# ThuHuong Restaurant — Project Guide for Claude

---

## ⚡ POST-COMPACT UPDATE PROTOCOL (MANDATORY)

**Trigger**: Khi conversation bắt đầu bằng một đoạn tóm tắt compaction (có dạng `This session is being continued from a previous conversation...` hoặc `Summary:` block), Claude PHẢI thực hiện các bước sau TRƯỚC KHI trả lời bất kỳ câu hỏi nào:

### Bước 1 — Trích xuất thông tin mới từ summary

Đọc summary và tìm:
- Lỗi mới đã phát hiện và cách fix
- Endpoint mới đã implement
- Convention mới đã thống nhất
- Service nào đã hoàn thiện / còn pending
- Quyết định thiết kế mới

### Bước 2 — Cập nhật CLAUDE.md

Nếu có pitfall mới → thêm vào bảng **Known Pitfalls**
Nếu có endpoint mới → thêm vào **Endpoints Reference**
Nếu có convention mới → thêm vào phần tương ứng

### Bước 3 — Cập nhật Memory Files

Luôn cập nhật các file sau trong `C:\Users\AD\.claude\projects\d--ThuHuongRestaurant\memory\`:
- `project-pitfalls.md` — thêm bug mới nếu có
- `project-completed-work.md` — cập nhật trạng thái service, pending tasks
- `project-conventions.md` — nếu có pattern mới được thống nhất

### Bước 4 — Cập nhật 3 Sub-Agents

Nếu phát hiện pitfall mới liên quan đến security/config → cập nhật `.claude/agents/research.md`
Nếu có convention/pattern mới → cập nhật `.claude/agents/code-review.md` checklist
Nếu có lỗi API mới với cách debug → cập nhật `.claude/agents/qa-testing.md`

### Quy tắc

- Thực hiện các bước này **im lặng** (không cần thông báo dài dòng cho user)
- Sau khi update xong, trả lời ngắn: `Đã cập nhật CLAUDE.md / memory / agents với [X thay đổi].`
- Nếu summary không có gì mới so với hiện tại → bỏ qua, không cần update

---

## Project Overview

Spring Boot 3.3.4 Microservices system for restaurant management.
Java 21 · Spring Cloud 2023.0.3 · MySQL 8 · RabbitMQ · Docker Compose.

---

## Architecture

```
Client → API Gateway (8080)
              ├── /api/v1/auth/**         → auth-service        (8082)
              ├── /api/v1/users/**        → user-service        (8083)
              ├── /api/v1/products/**     → product-service     (8084)
              ├── /api/v1/inventory/**    → inventory-service   (8085)
              ├── /api/v1/orders/**       → order-service       (8086)
              ├── /api/v1/bookings/**     → order-service       (8086)
              ├── /api/v1/payments/**     → payment-service     (8087)
              └── /api/v1/dashboard/**   → dashboard-service   (8088)

Discovery: Eureka (discovery-server:8761)
Config:    Config Server (config-server:8888) ← GitHub: tranphuc1607/microservice-config-repo
Message:   RabbitMQ (rabbitmq:5672) — Spring Cloud Bus for config refresh
Shared lib: restaurant-common (installed in ~/.m2, NOT a Maven module)
```

### Ports exposed to host

| Container | Host Port | Notes |
|-----------|-----------|-------|
| api-gateway | 8080 | Entry point duy nhất cho client |
| auth-service | 8082 | Debug trực tiếp nếu cần |
| discovery-server | 8761 | Eureka dashboard |
| config-server | 8888 | Config refresh |
| mysql | 3307 | MySQL client connect |
| rabbitmq | 5672, 15672 | AMQP + management UI |
| order-service | **không expose** | Chỉ qua gateway |
| payment-service | **không expose** | Chỉ qua gateway — bảo vệ webhook |
| dashboard-service | **không expose** | Chỉ qua gateway |

---

## Module Structure

```
ThuHuongRestaurant/
├── back-end/                ← toàn bộ Spring Boot microservices
│   ├── api-gateway/
│   ├── config-server/
│   ├── discovery-server/
│   ├── service/
│   │   ├── auth-service/        (port 8082, DB: auth_db)
│   │   ├── user-service/        (port 8083, DB: user_db)
│   │   ├── product-service/     (port 8084, DB: product_db)
│   │   ├── inventory-service/   (port 8085, DB: inventory_db)
│   │   ├── order-service/       (port 8086, DB: order_db)  ← cũng handle bookings
│   │   ├── payment-service/     (port 8087, DB: payment_db)
│   │   ├── hr-service/          (port 8089, DB: hr_db)
│   │   └── dashboard-service/   (port 8088, KHÔNG có DB — pure Feign aggregation)
│   ├── docker-compose.yml
│   ├── init.sql                 ← tạo database schema (tables do Hibernate DDL)
│   └── pom.xml                  ← parent POM, liệt kê modules
└── front-end/               ← Next.js 15, TypeScript, Tailwind CSS, App Router
    ├── src/app/             ← pages & layouts (App Router)
    ├── src/components/      ← React components
    └── package.json
```

> **Working directory cho Maven/Docker**: phải `cd back-end` hoặc dùng flag `-f back-end/pom.xml` / `-f back-end/docker-compose.yml`.

### Service đặc biệt: dashboard-service

- **Không có DB** → dùng `spring.autoconfigure.exclude=DataSourceAutoConfiguration`
- Gọi parallel 10 Feign calls bằng `CompletableFuture.supplyAsync()`, mỗi call có try-catch (null = service down)
- JWT forwarding: `FeignConfig.authorizationInterceptor()` đọc token từ `RequestContextHolder`
- Single endpoint: `GET /api/v1/dashboard/summary` (ROLE_ADMIN)
- **Cần thêm route vào GitHub config repo** trước khi gateway nhận được — xem mục Config Server

---

## Naming Conventions

### Packages

| Layer | Package | Example |
|-------|---------|---------|
| Root | `com.example.<servicename>` | `com.example.authservice` |
| Controller | `controller` | `AuthController` |
| Service | `service` | `AuthService` |
| Repository | `repository` | `AuthRepository` |
| Entity | `entity` | `Auth`, `User`, `Product` |
| Request DTO | `entity.DTO.req` | `LoginRequest` |
| Response DTO | `entity.DTO.res` | `LoginResponse` |
| Enums | `entity.enums` | `ProductCategory` |
| Config | `config` | `SecurityConfig` |
| Util | `util` | `SecurityUtil` |
| Bot | `bot` | `BookingAdminBot` |
| Feign client | `client` | `ProductServiceClient` |
| Feign DTO | `client.dto` | `OrderDeductionPayload` |
| Feign fallback | `client.fallback` | `ProductServiceFallback` |

> **Exception:** `inventory-service` và `product-service` dùng **lowercase** `entity.dto.req` / `entity.dto.res`. Các service mới dùng `entity.DTO.req` / `entity.DTO.res` (capital DTO).

### Class Names

```
Entity         : PascalCase noun               → Auth, Product, Ingredient
Request DTO    : <Entity><Action>Request       → LoginRequest, CreateUserRequest
Response DTO   : <Entity>Response              → LoginResponse, UserResponse
Service        : <Entity>Service (no impl)     → AuthService, UserService
Controller     : <Entity>Controller            → AuthController, UserController
Repository     : <Entity>Repository            → AuthRepository, UserRepository
Config         : <Topic>Config                 → SecurityConfig, RedisConfig
Enum           : PascalCase                    → ProductCategory, ProductStatus
Bot            : <Topic>Bot                    → BookingAdminBot
Feign client   : <Service>Client               → ProductServiceClient
```

### File & Method Names

- Java files: **PascalCase**
- Methods, variables: **camelCase**
- Constants: **UPPER_SNAKE_CASE**
- DB columns: **snake_case** (`@Column(name = "...")`)
- URL paths: **kebab-case** (`/api/v1/orders/tables`, `/api/v1/payments/webhook/sepay`)

---

## Code Conventions

### Entity Classes

```java
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@DynamicUpdate
// Extend BaseEntity cho createdAt, updatedAt, createdBy, updatedBy
public class Product extends BaseEntity { ... }

// Soft delete
@SQLDelete(sql = "UPDATE products SET is_deleted = true WHERE id = ?")
@SQLRestriction("is_deleted = false")

// Default values
@Builder.Default
private boolean isDeleted = false;
```

> **KHÔNG dùng @Data trên Entity** — gây vấn đề với JPA lazy loading (equals/hashCode). Dùng @Getter @Setter riêng.

### DTO Classes

```java
@Data
public class CreateUserRequest {
    @NotBlank(message = "...")
    private String username;
}

@Data @Builder
public class UserResponse {
    public static UserResponse from(User user) { ... }
}
```

### Service Classes

```java
@Service
@RequiredArgsConstructor
public class UserService {
    private final UserRepository userRepository;

    // MessageException → GlobalExceptionHandler → 400 BAD_REQUEST
    public void doSomething() throws MessageException {
        if (exists) throw new MessageException("Đã tồn tại");
    }

    // NEVER return String — luôn dùng Map / object
    public ResponseEntity<?> logout(...) {
        return ResponseEntity.ok().body(Map.of("message", "Thành công"));
    }
}
```

### Controller Classes

```java
@RestController
@RequestMapping("/api/v1/<resource>")
@RequiredArgsConstructor
public class UserController {

    // hasAuthority('ROLE_ADMIN') — KHÔNG dùng hasRole('ROLE_ADMIN')
    // vì JWT đã có ROLE_ prefix, hasRole() sẽ thêm thêm → ROLE_ROLE_ADMIN
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    @GetMapping
    public ResponseEntity<Page<UserResponse>> getAll(...) { ... }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMe(@AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getSubject();
        List<String> roles = jwt.getClaimAsStringList("roles"); // claim name là "roles"
    }
}
```

### SecurityConfig (per service)

```java
// KHÔNG thêm @RefreshScope vào @Configuration
// CGLIB proxy phá vỡ SecurityFilterChain/SecurityWebFilterChain
@Configuration
@EnableWebSecurity          // MVC services
// @EnableWebFluxSecurity   // WebFlux (api-gateway only)
@EnableMethodSecurity(prePostEnabled = true)
public class SecurityConfig { ... }
```

### Application Main Class

```java
// Phải scan restaurant_common để có GlobalExceptionHandler + FormRestResponse
@SpringBootApplication
@ComponentScan(basePackages = {"com.example.<servicename>", "com.example.restaurant_common"})
public class XxxServiceApplication { ... }
```

### Feign Client (service-to-service)

```java
// Trong service gọi ra (e.g., order-service)
@FeignClient(name = "product-service", configuration = FeignConfig.class,
             fallbackFactory = ProductServiceFallbackFactory.class)
public interface ProductServiceClient {
    @GetMapping("/api/v1/products/{id}")
    Map<String, Object> getProduct(@PathVariable Long id);
}

// FeignConfig — forward JWT token sang downstream service
@Configuration
public class FeignConfig {
    @Bean
    public RequestInterceptor authorizationInterceptor() {
        return template -> {
            HttpServletRequest request = ((ServletRequestAttributes)
                RequestContextHolder.getRequestAttributes()).getRequest();
            String auth = request.getHeader("Authorization");
            if (auth != null) template.header("Authorization", auth);
        };
    }
}
```

---

## Key Enums (Không được giả định — phải đúng với code)

### OrderStatus (order-service)

```java
public enum OrderStatus { OPEN, PAID, CANCELLED }
// KHÔNG có CONFIRMED hoặc COMPLETED — đây là pitfall phổ biến
```

### BookingStatus (order-service)

```java
public enum BookingStatus {
    PENDING_PAYMENT, CONFIRMED, CHECKED_IN, COMPLETED, CANCELLED, EXPIRED
}
```

### BookingPaymentMethod (order-service)

```java
public enum BookingPaymentMethod { BANK_TRANSFER, CASH }
```

### PaymentMethod / PaymentStatus (payment-service)

```java
public enum PaymentMethod { CARD, CASH, BANK_TRANSFER }
public enum PaymentStatus { PENDING, COMPLETED }
```

---

## restaurant-common Library

Shared JAR: `~/.m2/repository/com/example/restaurant-common/0.0.1-SNAPSHOT/`

| Class | Purpose |
|-------|---------|
| `BaseEntity` | Audit fields: createdAt, updatedAt, createdBy, updatedBy |
| `MessageException` | Checked exception → HTTP 400 |
| `GlobalExceptionHandler` | Xử lý `MessageException`, `MethodArgumentNotValidException` |
| `FormRestResponse` | `ResponseBodyAdvice` — wrap toàn bộ response trong `RestResponse` |
| `RestResponse<T>` | `{statusCode, message, data, error}` |

**Critical:** `FormRestResponse` wrap mọi response. Xung đột với `StringHttpMessageConverter` khi return `String`. **Luôn return `Map` hoặc object, không bao giờ return `String`.**

---

## Security

### JWT

- Algorithm: **HS512**
- Secret: `app.security.jwt.secret` (Base64-encoded, trong `application.properties` trên GitHub)
- Access token: 3600s
- Refresh token: 2592000s (30 ngày, lưu trong HttpOnly cookie `refresh_token`)

### JWT Claims

```json
{
  "sub": "username",
  "roles": ["ROLE_USER"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### Role Hierarchy (gateway)

```
ROLE_ADMIN > ROLE_EMPLOYEE
```

ADMIN tự động có quyền của EMPLOYEE. Roles: `ROLE_ADMIN`, `ROLE_EMPLOYEE`, `ROLE_USER`.

### Public URLs (gateway SecurityConfig)

Method-specific matchers (khai báo TRƯỚC `publicUrls`):
```java
.pathMatchers(HttpMethod.POST, "/api/v1/bookings").permitAll()
.pathMatchers(HttpMethod.GET, "/api/v1/bookings/*").permitAll()
.pathMatchers(HttpMethod.POST, "/api/v1/payments/webhook/**").permitAll()
.pathMatchers(publicUrls).permitAll()
```

`publicUrls` từ shared `application.properties` (GitHub):
```
/api/v1/auth/**
/api/v1/products/**
/eureka/**
/actuator/**
/h2-console/**
```

---

## Config Server

- GitHub repo: `https://github.com/tranphuc1607/microservice-config-repo`
- Files: `application.properties` (shared), `<service-name>.properties` (per service)
- Refresh runtime: `POST http://localhost:8888/actuator/busrefresh`

### Per-service Config (GitHub)

```properties
eureka.client.service-url.defaultZone=http://discovery-server:8761/eureka/
eureka.client.register-with-eureka=true
eureka.client.fetch-registry=true

spring.datasource.url=jdbc:mysql://mysql:3306/<service>_db
spring.datasource.username=root
spring.datasource.password=123456
spring.jpa.hibernate.ddl-auto=update
```

### Route config cần thêm thủ công vào GitHub cho dashboard-service

```properties
# Thêm vào application.properties trên GitHub (index tiếp theo sau route cuối cùng)
spring.cloud.gateway.routes[8].id=dashboard-service
spring.cloud.gateway.routes[8].uri=lb://dashboard-service
spring.cloud.gateway.routes[8].predicates[0]=Path=/api/v1/dashboard/**
```

Sau khi push → `POST http://localhost:8888/actuator/busrefresh`

---

## Database

- MySQL 8, host port **3307** (container 3306)
- Credentials: root / 123456
- Databases: `auth_db`, `user_db`, `product_db`, `inventory_db`, `order_db`, `payment_db`
- Tables tạo tự động bởi Hibernate (`ddl-auto=update`)
- **`ddl-auto=update` KHÔNG xóa `NOT NULL` constraints** — phải ALTER thủ công:
  ```sql
  ALTER TABLE <table> MODIFY COLUMN <col> VARCHAR(255) NULL;
  ```

### Lazy user provisioning

`auth-service` tạo `Auth` record; `user-service` có bảng `User` riêng. Hai bảng không sync tự động.
- `GET /api/v1/users/me` tự động tạo `User` profile tối thiểu (username + role từ JWT) nếu chưa có trong user_db.
- Lý do: giữ auth-service và user-service độc lập — không cần Feign call khi register.

---

## Payment Flow

### 3 phương thức thanh toán

| Method | Flow | Trạng thái khởi đầu |
|--------|------|-----------|
| `CARD` | Auto-complete qua POS ngay | `COMPLETED` ngay lập tức |
| `CASH` | Nhân viên thu tiền rồi confirm | `PENDING` → EMPLOYEE/ADMIN PATCH `/{id}/confirm` → `COMPLETED` |
| `BANK_TRANSFER` | Sinh VietQR, Sepay webhook auto-confirm | `PENDING` → Sepay webhook → `COMPLETED` |

### VietQR Config (`payment-service/src/main/resources/application.properties`)

```properties
app.payment.bank-id=TPB
app.payment.account-number=0357527135
app.payment.account-holder=TRAN MINH PHUC
app.payment.bank-name=TPBank
```

Nội dung chuyển khoản pattern: `TH{paymentId}` — Sepay webhook extract bằng regex `TH(\d+)`.

### Sepay Webhook

- Endpoint: `POST /api/v1/payments/webhook/sepay` (public ở gateway)
- Auth: header `Authorization: Apikey {key}`
- Key lấy từ env var `SEPAY_WEBHOOK_APIKEY` trong docker-compose
- IP whitelist: `SEPAY_WEBHOOK_ALLOWED_IPS=*` (dev), production dùng IP thật của Sepay

---

## Telegram Notifications

### payment-service — Thông báo thanh toán

Cấu hình trong `service/payment-service/src/main/resources/application.properties`:
```properties
telegram.bot.token=<token-from-botfather>
telegram.bot.chat-id=<group-chat-id>
```

Gửi async qua `CompletableFuture.runAsync()` — không block request chính.

| Event | Message |
|-------|---------|
| Tạo payment CASH | 🔔 Yêu cầu thanh toán tiền mặt + số tiền + ID confirm |
| Tạo payment BANK_TRANSFER | 💳 Đang chờ chuyển khoản + số tiền + VietQR URL |
| Confirm CASH payment | ✅ Đã thanh toán tiền mặt thành công |
| Sepay webhook hoàn thành | ✅ Đã nhận chuyển khoản thành công |

**Lưu ý quan trọng:**
- Nếu group Telegram migrate từ regular group lên supergroup, chat ID thay đổi (dạng `-100xxxxxxxxxx`). Kiểm tra bằng `getUpdates` — xem field `migrate_to_chat_id`.
- **Không đặt env var rỗng** trong docker-compose (e.g., `- TELEGRAM_BOT_TOKEN=`) — Spring Boot ưu tiên env var hơn application.properties nên sẽ override thành rỗng.

### order-service — BookingAdminBot

Bot quản lý booking qua Telegram. Cấu hình trong `order-service` (local `application.properties` hoặc GitHub):

```properties
booking.telegram.bot.token=<token>
booking.telegram.bot.username=<username>
booking.telegram.admin-ids=123456789,987654321   # comma-separated Telegram user IDs
```

**Class**: `com.example.orderservice.bot.BookingAdminBot` (extends `TelegramLongPollingBot`)

**Bot commands:**

| Command | Mô tả |
|---------|-------|
| `/start` | Hiển thị menu lệnh |
| `/pending` | Danh sách booking PENDING_PAYMENT (10 mới nhất) với nút Xác nhận/Hủy |
| `/today` | Lịch đặt bàn hôm nay (không EXPIRED/CANCELLED) |

**Inline keyboard callbacks:**

| Callback data | Hành động |
|---------------|----------|
| `CONFIRM_BOOKING:{id}` | Xác nhận booking (BANK_TRANSFER) — gọi `confirmBooking()` |
| `CANCEL_BOOKING:{id}` | Hủy booking — gọi `cancelBooking()` |

**Push methods (gọi từ BookingService):**

| Method | Khi nào gọi |
|--------|------------|
| `notifyConfirmed(booking, confirmedBy)` | Sau khi CONFIRM hoặc CONFIRM_CASH thành công |
| `notifyAutoConfirmed(booking)` | Sau khi Sepay webhook tự xác nhận booking |
| `notifyReminder(booking)` | 1 tiếng trước `scheduledTime` (scheduled task) |

**Circular dependency**: `BookingService` → `BookingAdminBot` → `BookingService`  
Fix: inject `BookingService` vào bot với `@Autowired @Lazy`.

---

## Booking Validation Rules

```java
// scheduledTime phải sau hiện tại ít nhất 1 tiếng (nhà hàng cần chuẩn bị)
if (scheduledTime.isBefore(Instant.now().plus(1, ChronoUnit.HOURS))) {
    throw new MessageException("Vui lòng đặt bàn trước giờ đến dự kiến ít nhất 1 giờ");
}
// Giờ phục vụ 08:00–22:00 (VN timezone UTC+7)
ZonedDateTime zdt = scheduledTime.atZone(VN_ZONE); // ZoneId.of("Asia/Ho_Chi_Minh")
int hour = zdt.getHour();
if (hour < 8 || hour >= 22) {
    throw new MessageException("Quán chỉ phục vụ từ 08:00 đến 22:00");
}
```

**Timezone quan trọng:** `scheduledTime` trong request dùng ISO-8601 UTC (`Z` suffix). Quy đổi sang VN:
- `01:00Z` = 08:00 VN
- `05:00Z` = 12:00 VN
- `11:00Z` = 18:00 VN

Conflict check: trong vòng ±2 giờ quanh `scheduledTime`, bàn đó không được có booking khác đang active.

---

## Inter-Service Communication (Feign)

| Caller | Target | Mục đích |
|--------|--------|---------|
| order-service | product-service | Lấy thông tin + giá sản phẩm khi tạo booking/order |
| order-service | inventory-service | Trừ/hoàn kho khi confirm/cancel booking |
| payment-service | order-service | Lấy thông tin order, gọi `checkout-internal` |
| dashboard-service | payment-service | `GET /api/v1/payments/revenue?from=&to=` — doanh thu |
| dashboard-service | order-service | `GET /api/v1/orders/stats` + `GET /api/v1/bookings/stats` |
| dashboard-service | inventory-service | `GET /api/v1/inventory/ingredients/low-stock` |
| dashboard-service | user-service | `GET /api/v1/users/stats` |

**Internal endpoint** (không qua auth): `POST /api/v1/orders/{orderId}/checkout-internal`
- Chỉ gọi từ payment-service qua Feign (trong Docker network)
- Không có `@PreAuthorize` — bảo vệ bằng cách không expose port order-service ra ngoài

---

## Build & Deploy

### Maven

```powershell
# Phải cd vào back-end trước (hoặc dùng -f back-end/pom.xml)
cd back-end

# Build một service
mvn clean package -pl service/payment-service -am -DskipTests

# Build nhiều service cùng lúc
mvn clean package -pl service/order-service,service/dashboard-service -am -DskipTests

# Build tất cả
mvn clean package -DskipTests
```

> **Pitfall Windows:** `.\mvnw.cmd` có thể không nhận diện đúng trong PowerShell. Dùng `mvn` nếu đã cài Apache Maven tại `C:\apache-maven\`.

### Docker Compose

```powershell
# Chạy từ back-end/ hoặc dùng -f back-end/docker-compose.yml
cd back-end

# Luôn chạy Maven TRƯỚC — Dockerfile copy target/*.jar, không tự chạy Maven
mvn clean package -pl service/payment-service -am -DskipTests
docker compose up --build -d payment-service

# Rebuild nhiều service
mvn clean package -pl service/order-service,service/dashboard-service -am -DskipTests
docker compose up --build -d order-service dashboard-service

# Rebuild tất cả
mvn clean package -DskipTests
docker compose up --build -d
```

### Front-end (Next.js)

```powershell
cd front-end
npm run dev        # localhost:3000
npm run build      # production build
```

API Gateway: `http://localhost:8080/api/v1` — cấu hình trong `front-end/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
```

### Startup order (enforced via healthcheck + depends_on)

```
mysql + rabbitmq → discovery-server → config-server → business services → api-gateway
```

### Kiểm tra logs

```powershell
cd back-end
docker compose logs -f <service-name>
docker compose ps
```

---

## API Response Format

Tất cả response được wrap bởi `FormRestResponse`:

```json
{
    "statusCode": 200,
    "message": "call api success",
    "data": { ... },
    "error": null
}
```

Error:
```json
{
    "statusCode": 400,
    "message": "Tên đăng nhập này đã có người sử dụng!",
    "data": null,
    "error": "Bad Request"
}
```

**Lưu ý:** Dashboard-service response (`DashboardResponse`) cũng được wrap trong `data` field.

---

## Known Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| 401 trên tất cả endpoint | `@RefreshScope` trên `SecurityConfig` | Xóa `@RefreshScope` khỏi mọi `@Configuration` |
| 500 ClassCastException khi return String | `FormRestResponse` + `StringHttpMessageConverter` | Không bao giờ return `String` — dùng `Map.of("message", "...")` |
| `GlobalExceptionHandler` không tìm thấy | `restaurant_common` thiếu trong component scan | Thêm `@ComponentScan({"com.example.<service>", "com.example.restaurant_common"})` |
| Docker dùng code cũ sau `--build` | Dockerfile copy `target/*.jar`, không chạy Maven | Luôn chạy `mvn clean package` trước `docker compose up --build` |
| `ddl-auto=update` không xóa NOT NULL | Hibernate update mode limitation | `ALTER TABLE ... MODIFY COLUMN ... NULL` thủ công |
| 404 `path: "/"` từ gateway | `@RefreshScope` trên gateway `SecurityConfig` | Xóa `@RefreshScope` |
| `hasRole('ROLE_ADMIN')` luôn fail | `hasRole()` thêm `ROLE_` → `ROLE_ROLE_ADMIN` | Dùng `hasAuthority('ROLE_ADMIN')` |
| Telegram không gửi được | Env var rỗng trong docker-compose override application.properties | Không khai báo env var Telegram trong docker-compose nếu dùng hardcode trong app.properties |
| Telegram sai chat ID sau migrate group | Regular group → supergroup đổi ID | Kiểm tra `getUpdates` → field `migrate_to_chat_id`; update `telegram.bot.chat-id` |
| Webhook Sepay bị 401 | Gateway public-urls không include webhook path | Dùng method-specific matcher: `.pathMatchers(HttpMethod.POST, "/api/v1/payments/webhook/**").permitAll()` |
| Booking test lỗi "đặt trước 1 giờ" | `scheduledTime` đã qua hoặc quá gần | Dùng ngày tương lai ≥ 1 tiếng; nhớ `Z` = UTC (VN = UTC+7) |
| `mvnw.cmd` không chạy trên Windows | PowerShell không nhận | Dùng `mvn` (cài sẵn tại `C:\apache-maven\`) |
| `OrderStatus.CONFIRMED` không tồn tại | Enum chỉ có OPEN, PAID, CANCELLED | Không giả định enum có thêm giá trị — luôn đọc file enum trước |
| `@Builder.Default` thiếu → field initializer bị bỏ qua | Lombok `@Builder` bỏ qua initializer không có annotation | Thêm `@Builder.Default` vào mọi field có giá trị default trong `@Builder` class |
| dashboard-service khởi động lỗi "No datasource" | Spring Boot auto-config database dù không có deps | Thêm `spring.autoconfigure.exclude=DataSourceAutoConfiguration` vào properties |
| dashboard-service 404 qua gateway | Route chưa có trong GitHub config repo | Thêm route `dashboard-service` vào `application.properties` trên GitHub + busrefresh |
| Circular dependency Bot ↔ Service | `BookingAdminBot` inject `BookingService`, `BookingService` inject bot | Dùng `@Autowired @Lazy` khi inject `BookingService` vào bot |
| Feign call mang JWT sang service khác thất bại | Không có `FeignConfig.authorizationInterceptor()` | Tạo `FeignConfig` đọc `Authorization` header từ `RequestContextHolder` |
| Frontend "không kết nối được máy chủ" | CORS preflight OPTIONS bị 403 — `api-gateway/SecurityConfig` thiếu `CorsConfigurationSource` bean | Thêm bean + wire vào `http.cors(...)`, set `allowCredentials=true`, `allowedOrigins=["http://localhost:3000"]`. Rebuild + redeploy api-gateway |
| Login hiển thị "Business Logic Exception" | auth-service đặt message tiếng Việt vào field `error`, không phải `message` | Dùng `extractApiError(json, fallback)` từ `lib/utils.ts` — pick field nào không phải chuỗi generic tiếng Anh |
| Feign client trả về DTO toàn 0/null dù backend OK | `FormRestResponse` wrap mọi response trong `{statusCode, message, data}` — Feign default decoder deserialize wrapper thay vì `data` | Thêm custom `Decoder` bean trong `FeignConfig` của service đó: đọc `JsonNode → path("data") → convertValue(data, type)` |
| Dashboard async Feign call bị 401 — JWT không được forward | `CompletableFuture.supplyAsync()` chạy trên ForkJoinPool riêng, `RequestContextHolder` dùng `ThreadLocal` không được kế thừa sang thread con | Capture `RequestAttributes attrs = RequestContextHolder.getRequestAttributes()` trên main thread TRƯỚC khi spawn, gọi `setRequestAttributes(attrs)` trong lambda, `resetRequestAttributes()` trong finally |
| Feign `catch (FeignException)` bỏ lọt RuntimeException từ fallback → HTTP 500 | `spring.cloud.openfeign.circuitbreaker.enabled=true`: khi downstream trả 4xx, Resilience4j gọi fallback (throws RuntimeException), không phải FeignException trực tiếp | Đổi `catch (FeignException e)` thành `catch (Exception e)` trong mọi Feign wrapper method. Cập nhật fallback để extract actual error message từ FeignException.contentUTF8() |
| `saleUnit` lưu tiếng Việt ("phần") → inventory-service 400 Jackson error | `OrderItem.saleUnit` là String, frontend gửi "phần" thay vì enum value "PORTION". `OrderDeductionRequest.saleUnit` là `SaleUnit` enum → Jackson fails | Thêm `@JsonAlias({"phần","Phần",...})` vào SaleUnit enum (backward-compat). Sửa frontend `SALE_UNITS` dùng `{value:"PORTION", label:"Phần"}` — gửi enum value thay label |
| Internal Feign endpoint bị 403 dù SecurityConfig `.permitAll()` | `@PreAuthorize` ở method level override URL-level `.permitAll()`. Scheduler/Feign không có JWT → method-level check fail | Bỏ `@PreAuthorize` khỏi endpoint nội bộ (e.g. `/deductions/order`). Handle nullable `Jwt jwt` bằng: `String performer = (jwt != null) ? jwt.getSubject() : "service-name"` |
| Trang chi tiết booking "Không tìm thấy booking" | `GET /api/v1/bookings/{bookingCode}` chỉ nhận `bookingCode` (chuỗi), không có endpoint tra theo `id` số. Trang danh sách link bằng `b.id` thay vì `b.bookingCode` | Link sang trang chi tiết bằng `b.bookingCode`. Action PATCH/POST (`/complete`, `/checkout-to-order`, ...) vẫn dùng numeric `booking.id` lấy SAU khi fetch chi tiết thành công, không phải từ route param |
| Next.js Server Component fetch "không tìm thấy" dù API trả 200 | `NEXT_PUBLIC_API_URL=/api/v1` là relative URL → Node.js `fetch()` throws `TypeError: Invalid URL`, bị silent `catch { return null; }` | Trong Server Component dùng: `process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1"` |
| Next.js source thay đổi nhưng browser vẫn chạy code cũ | `.next/` cache phục vụ bundle đã compile cũ dù source đã sửa — HMR không rebuild đúng trong một số trường hợp | Xóa `.next/` và restart: `cd front-end && rm -rf .next && npm run dev` |
| Buttons hoạt động trong DevTools nhưng không bấm được trên điện thoại thật | (1) Next.js 15 thiếu `viewport` export. (2) Thiếu `touch-action: manipulation` + `cursor: pointer` CSS. (3) iOS Safari: `onClick` không fire trên `sticky` elements hoặc khi touch→click conversion bị block. (4) Tap target < 44px | **Pattern chuẩn cho button mobile-critical**: thêm `onPointerDown={(e) => { if (e.pointerType === "touch") { e.preventDefault(); fn(); } }}` + giữ `onClick={fn}` cho desktop. `e.preventDefault()` trên touch pointerdown ngăn browser generate compat click event (không double-fire). Áp dụng cho: hamburger, slider arrows, cart buttons. CSS: `viewport` export, `touch-action: manipulation`, `cursor: pointer`, `-webkit-tap-highlight-color: transparent` |

---

## Endpoints Reference

### Auth Service → `localhost:8080/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/register` | Public | Đăng ký tài khoản |
| POST | `/login` | Public | Đăng nhập, trả JWT + set refresh cookie |
| POST | `/refresh` | Cookie | Rotate access + refresh token |
| POST | `/logout` | Cookie | Xóa refresh token |

### User Service → `localhost:8080/api/v1/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | USER | Xem profile của mình |
| PUT | `/me` | USER | Cập nhật profile |
| GET | `/` | ADMIN | Danh sách user (phân trang) |
| GET | `/search?keyword=` | ADMIN | Tìm kiếm user |
| GET | `/{id}` | ADMIN | Xem user theo ID |
| POST | `/` | ADMIN | Tạo user |
| PATCH | `/{id}/role` | ADMIN | Đổi role |
| PATCH | `/{id}/status` | ADMIN | Bật/tắt tài khoản |
| DELETE | `/{id}` | ADMIN | Xóa user |
| GET | `/stats` | ADMIN | Đếm admin/employee active (cho dashboard) |

### Product Service → `localhost:8080/api/v1/products`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Danh sách sản phẩm |
| GET | `/{id}` | Public | Chi tiết sản phẩm |
| POST | `/` | ADMIN | Tạo sản phẩm |
| PUT | `/{id}` | ADMIN | Cập nhật sản phẩm |
| DELETE | `/{id}` | ADMIN | Soft delete sản phẩm |

### Inventory Service → `localhost:8080/api/v1/inventory`

**Ingredients** (`/inventory/ingredients`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ingredients` | EMPLOYEE+ | Danh sách nguyên liệu |
| GET | `/ingredients/search?keyword=` | EMPLOYEE+ | Tìm kiếm |
| GET | `/ingredients/low-stock` | EMPLOYEE+ | Nguyên liệu sắp hết (dùng cho dashboard) |
| GET | `/ingredients/{id}` | EMPLOYEE+ | Chi tiết |
| POST | `/ingredients` | ADMIN | Tạo nguyên liệu |
| PUT | `/ingredients/{id}` | ADMIN | Cập nhật |
| PATCH | `/ingredients/{id}/deactivate` | ADMIN | Ngừng sử dụng |

**Recipes** (`/inventory/recipes`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recipes/product/{productId}` | EMPLOYEE+ | Công thức của sản phẩm |
| POST | `/recipes` | ADMIN | Tạo công thức |
| DELETE | `/recipes/{id}` | ADMIN | Xóa công thức |
| DELETE | `/recipes/product/{productId}` | ADMIN | Xóa tất cả công thức của sản phẩm |

**Unit Conversions** (`/inventory/conversions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/conversions/ingredient/{ingredientId}` | EMPLOYEE+ | Quy đổi đơn vị |
| POST | `/conversions` | ADMIN | Tạo quy đổi |
| PUT | `/conversions/{id}` | ADMIN | Cập nhật |
| DELETE | `/conversions/{id}` | ADMIN | Xóa |

**Imports** (`/inventory/imports`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/imports` | ADMIN | Nhập kho |
| GET | `/imports` | ADMIN | Lịch sử nhập kho |

**Deductions** (`/inventory/deductions`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/deductions/manual` | EMPLOYEE+ | Xuất kho thủ công |
| POST | `/deductions/adjust` | ADMIN | Điều chỉnh tồn kho |
| POST | `/deductions/order` | EMPLOYEE+ | Trừ kho theo đơn hàng |
| POST | `/deductions/stock-check` | EMPLOYEE+ | Kiểm tra tồn kho |
| POST | `/deductions/booking-restore` | EMPLOYEE+ | Hoàn kho khi hủy booking |
| GET | `/deductions` | ADMIN | Lịch sử xuất kho |

### Order Service → `localhost:8080/api/v1/orders`

**Orders**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | EMPLOYEE+ | Tạo order tại bàn |
| GET | `/` | ADMIN | Danh sách orders |
| GET | `/table/{qrToken}` | Public | Order hiện tại của bàn qua QR token |
| GET | `/{orderId}` | EMPLOYEE+ | Chi tiết order |
| POST | `/{orderId}/items` | EMPLOYEE+ | Thêm món vào order |
| DELETE | `/{orderId}/items/{itemId}` | EMPLOYEE+ | Xóa món khỏi order |
| POST | `/{orderId}/confirm` | ADMIN | Xác nhận order |
| POST | `/{orderId}/checkout` | EMPLOYEE+ | Checkout order |
| POST | `/{orderId}/cancel` | ADMIN | Hủy order |
| POST | `/{orderId}/checkout-internal` | **Internal** | Dùng bởi payment-service (không expose) |
| GET | `/stats` | ADMIN | Thống kê đơn hàng hôm nay + top 5 món tháng này |

**Tables** (`/orders/tables`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/orders/tables` | EMPLOYEE+ | Danh sách bàn |
| GET | `/orders/tables/{id}` | EMPLOYEE+ | Chi tiết bàn |
| POST | `/orders/tables` | ADMIN | Tạo bàn |
| PUT | `/orders/tables/{id}` | ADMIN | Cập nhật bàn |
| DELETE | `/orders/tables/{id}` | ADMIN | Xóa bàn |

### Booking Service → `localhost:8080/api/v1/bookings`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | **Public** | Đặt bàn trước (khách tự đặt) |
| GET | `/{bookingCode}` | **Public** | Xem trạng thái booking |
| GET | `/` | ADMIN | Danh sách booking |
| PATCH | `/{id}/confirm` | ADMIN | Xác nhận BANK_TRANSFER + trừ kho |
| PATCH | `/{id}/confirm-cash` | ADMIN | Xác nhận CASH (trừ kho, khách trả khi đến) |
| PATCH | `/{id}/complete` | EMPLOYEE+ | Hoàn thành booking |
| PATCH | `/{id}/cancel` | ADMIN | Hủy booking + hoàn kho |
| PATCH | `/cancel/{bookingCode}` | **Public** | Khách tự hủy (chỉ PENDING_PAYMENT); body: `{customerPhone, cancelReason}` |
| POST | `/{id}/checkout-to-order` | EMPLOYEE+ | Chuyển booking thành order tại bàn |
| GET | `/stats` | ADMIN | Thống kê booking: pending, confirmed hôm nay, sắp tới 2h |

### Payment Service → `localhost:8080/api/v1/payments`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | EMPLOYEE+ | Tạo giao dịch thanh toán |
| PATCH | `/{id}/confirm` | EMPLOYEE+ | Xác nhận thanh toán tiền mặt |
| GET | `/{id}` | EMPLOYEE+ | Chi tiết giao dịch |
| GET | `/orders/{orderId}` | EMPLOYEE+ | Giao dịch theo order ID |
| GET | `/` | ADMIN | Danh sách giao dịch |
| GET | `/revenue?from=&to=` | ADMIN | Doanh thu theo khoảng thời gian (dùng cho dashboard) |
| POST | `/webhook/sepay` | **Public** | Webhook từ Sepay (auto-confirm BANK_TRANSFER) |

### HR Service → `localhost:8080/api/v1/hr`

**Employees** (`/hr/employees`) — ROLE_ADMIN

| Method | Path | Description |
|--------|------|-------------|
| GET | `/employees?page=&size=&search=` | Danh sách nhân viên (paginated) |
| GET | `/employees/{id}` | Chi tiết nhân viên |
| GET | `/employees/by-user/{userId}` | Tìm Employee theo userId (liên kết user-service ↔ hr-service) |
| POST | `/employees` | Tạo nhân viên (name*, phone, telegramId, type*, salaryType*, baseValue*, targetDays nếu FIXED, userId optional) |
| PUT | `/employees/{id}` | Cập nhật thông tin |
| PATCH | `/employees/{id}/deactivate` | Vô hiệu hóa |
| PATCH | `/employees/{id}/activate` | Kích hoạt lại |
| PATCH | `/employees/{id}/link-telegram` | Liên kết Telegram (body: `{telegramId: Long}`) |

**Shifts** (`/hr/shifts`) — ROLE_ADMIN

| Method | Path | Description |
|--------|------|-------------|
| GET | `/shifts` | Danh sách ca làm |
| GET | `/shifts/{id}` | Chi tiết ca |
| POST | `/shifts` | Tạo ca (name*, startTime*, endTime*) |
| PUT | `/shifts/{id}` | Cập nhật ca |
| DELETE | `/shifts/{id}` | Vô hiệu hóa ca (không xóa thật) |
| POST | `/shifts/assign` | Phân ca (employeeId*, shiftId*, daysOfWeek* List, effectiveFrom*, effectiveTo nullable) |
| GET | `/shifts/assignments?employeeId=` | Phân ca của một nhân viên |
| GET | `/shifts/schedule?weekOffset=` | Lịch tuần (weekOffset=0 là tuần này) |
| DELETE | `/shifts/assignments/{assignmentId}` | Hủy một phân ca cụ thể (set active=false) |

**Attendance** (`/hr/attendance`) — ROLE_ADMIN

| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance?employeeId=&month=&year=&page=&size=` | Bảng chấm công |
| GET | `/attendance/{id}` | Chi tiết một bản ghi |
| PATCH | `/attendance/{id}` | Sửa giờ (field: "checkInTime"\|"checkOutTime", newTime ISO-8601, reason) |
| POST | `/attendance/{id}/punish` | Ghi phạt (amount: Double, reason*) |
| DELETE | `/attendance/{id}/punish` | Xóa khoản phạt |

**Payroll** (`/hr/payroll`) — ROLE_ADMIN

| Method | Path | Description |
|--------|------|-------------|
| GET | `/payroll?month=&year=` | Bảng lương tất cả NV (trả `List`, không phải `Page`) |
| GET | `/payroll/{employeeId}?month=&year=` | Lương của một nhân viên |

**Verify** (`/hr/verify`) — **Public**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/verify?token=` | Check-in/check-out via WiFi nội bộ. Trả HTML trực tiếp (không qua FormRestResponse). Token do HRTelegramBot generate (HMAC-signed). |

**HRTelegramBot** — cấu hình trong `hr-service/application.properties`:
```properties
hr.telegram.bot.token=<token>
hr.telegram.bot.username=<username>
hr.telegram.admin-ids=123456789,987654321
hr.wifi.allowed-ip=192.168.1.*   # hoặc "*" cho dev mode (check-in qua callback thay vì URL)
```

Bot commands (nhân viên): `/register`, `/checkin`, `/checkout`, `/swapshift`, `/myshift`, `/myattendance`, `/salary`
Bot commands (admin): `/employees`

**ShiftSwapService** — nhân viên tự đổi ca trong ngày (phải trước giờ ca ≥ 1 tiếng). Auto-approved, không cần admin duyệt. Thông báo admin qua Telegram. Không có REST endpoint — chỉ qua bot `/swapshift`.

**AttendanceResponse** fields quan trọng:
`checkInTime`, `checkOutTime`, `totalHours`, `lateMinutes`, `punished`, `punishmentAmount`, `punishmentReason`, `shiftName`, `workDate`

**PayrollResponse** fields: `net`, `gross`, `totalPunishment`, `actualWorkDays`, `totalHours`, `targetDays`
(`netSalary`/`totalDeductions` KHÔNG tồn tại — đây là pitfall phổ biến)

---

### Dashboard Service → `localhost:8080/api/v1/dashboard`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/summary` | ADMIN | Tổng quan: doanh thu 3 kỳ, đơn hàng, booking, kho, top 5 món, users |

**Response structure** (`DashboardResponse`):
```json
{
  "revenue": {
    "today": 0.0, "yesterday": 0.0, "todayChangePercent": 0.0,
    "thisWeek": 0.0, "lastWeek": 0.0, "weekChangePercent": 0.0,
    "thisMonth": 0.0, "lastMonth": 0.0, "monthChangePercent": 0.0,
    "todayTransactions": 0, "todayByMethod": {}
  },
  "orders": {
    "open": 0, "paid": 0, "cancelled": 0,
    "occupiedTables": 0,
    "topProducts": [{"productName": "", "quantity": 0}]
  },
  "bookings": { "pendingPayment": 0, "confirmedToday": 0, "upcomingIn2Hours": 0 },
  "inventory": { "lowStockCount": 0, "lowStockItems": [] },
  "users": { "activeAdmin": 0, "activeEmployee": 0, "totalActive": 0 }
}
```
