-- PostgreSQL 初始化脚本
-- Onela ORM Framework 测试数据库

-- 创建测试表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    age INT DEFAULT 0,
    status SMALLINT DEFAULT 1,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    profile JSONB,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.id IS '用户ID';
COMMENT ON COLUMN users.name IS '用户名';
COMMENT ON COLUMN users.email IS '邮箱';
COMMENT ON COLUMN users.age IS '年龄';
COMMENT ON COLUMN users.status IS '状态: 1=正常, 0=禁用';
COMMENT ON COLUMN users.balance IS '余额';
COMMENT ON COLUMN users.profile IS '用户资料';

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    order_no VARCHAR(50) NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    status SMALLINT DEFAULT 0,
    items JSONB,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

COMMENT ON TABLE orders IS '订单表';

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    category VARCHAR(50),
    tags JSONB,
    is_active SMALLINT DEFAULT 1,
    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);

COMMENT ON TABLE products IS '商品表';

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 应用触发器
DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_orders_modtime ON orders;
CREATE TRIGGER update_orders_modtime
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- 插入测试数据
INSERT INTO users (name, email, age, status, balance) VALUES
('张三', 'zhangsan@example.com', 25, 1, 1000.00),
('李四', 'lisi@example.com', 30, 1, 2500.50),
('王五', 'wangwu@example.com', 28, 1, 500.00),
('赵六', 'zhaoliu@example.com', 35, 0, 0.00),
('钱七', 'qianqi@example.com', 22, 1, 3000.00);

INSERT INTO products (name, price, stock, category, is_active) VALUES
('iPhone 15', 6999.00, 100, '手机', 1),
('MacBook Pro', 14999.00, 50, '电脑', 1),
('AirPods Pro', 1899.00, 200, '配件', 1),
('iPad Pro', 8999.00, 80, '平板', 1),
('Apple Watch', 3299.00, 150, '穿戴', 1);

INSERT INTO orders (user_id, order_no, amount, status) VALUES
(1, 'ORD20240101001', 6999.00, 2),
(1, 'ORD20240101002', 1899.00, 1),
(2, 'ORD20240102001', 14999.00, 2),
(3, 'ORD20240103001', 8999.00, 0),
(5, 'ORD20240105001', 3299.00, 1);
