CREATE DATABASE IF NOT EXISTS auth_db;
CREATE DATABASE IF NOT EXISTS user_db;
CREATE DATABASE IF NOT EXISTS product_db;
CREATE DATABASE IF NOT EXISTS inventory_db;
CREATE DATABASE IF NOT EXISTS order_db;
CREATE DATABASE IF NOT EXISTS payment_db;
CREATE DATABASE IF NOT EXISTS hr_db;

-- Mỗi service dùng user riêng, chỉ có quyền trên DB của mình
CREATE USER IF NOT EXISTS 'auth_user'@'%' IDENTIFIED BY 'auth_pass_2024';
GRANT ALL PRIVILEGES ON auth_db.* TO 'auth_user'@'%';

CREATE USER IF NOT EXISTS 'user_user'@'%' IDENTIFIED BY 'user_pass_2024';
GRANT ALL PRIVILEGES ON user_db.* TO 'user_user'@'%';

CREATE USER IF NOT EXISTS 'product_user'@'%' IDENTIFIED BY 'product_pass_2024';
GRANT ALL PRIVILEGES ON product_db.* TO 'product_user'@'%';

CREATE USER IF NOT EXISTS 'inventory_user'@'%' IDENTIFIED BY 'inventory_pass_2024';
GRANT ALL PRIVILEGES ON inventory_db.* TO 'inventory_user'@'%';

CREATE USER IF NOT EXISTS 'order_user'@'%' IDENTIFIED BY 'order_pass_2024';
GRANT ALL PRIVILEGES ON order_db.* TO 'order_user'@'%';

CREATE USER IF NOT EXISTS 'payment_user'@'%' IDENTIFIED BY 'payment_pass_2024';
GRANT ALL PRIVILEGES ON payment_db.* TO 'payment_user'@'%';

CREATE USER IF NOT EXISTS 'hr_user'@'%' IDENTIFIED BY 'hr_pass_2024';
GRANT ALL PRIVILEGES ON hr_db.* TO 'hr_user'@'%';

FLUSH PRIVILEGES;
