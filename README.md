oàn bộ backend chạy qua Docker Compose. Mở terminal, cd vào back-end/ trước:


cd d:\ThuHuongRestaurant\back-end
Lần đầu hoặc sau khi sửa code:


# 1. Build JAR trước
mvn clean package -DskipTests

# 2. Khởi động toàn bộ hệ thống
docker compose up --build -d
Chỉ restart một service (ví dụ order-service):


mvn clean package -pl service/order-service -am -DskipTests
docker compose up --build -d order-service
Không sửa code, chỉ start lại containers:


docker compose up -d
Kiểm tra trạng thái:


docker compose ps
docker compose logs -f order-service   # xem log realtime
Sau khi chạy:

API Gateway: http://localhost:8080
Eureka Dashboard: http://localhost:8761
RabbitMQ UI: http://localhost:15672
Chạy Frontend

cd d:\ThuHuongRestaurant\front-end

# Cài dependencies (chỉ lần đầu)
npm install

# Chạy development
npm run dev
Mở trình duyệt: http://localhost:3000

Build production:


npm run build
npm run start   # chạy bản production tại localhost:3000
Thứ tự khuyến nghị: Start backend trước (docker compose up -d) → đợi khoảng 30–60 giây cho tất cả service đăng ký vào Eureka → sau đó start frontend.