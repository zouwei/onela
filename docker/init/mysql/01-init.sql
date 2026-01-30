-- MySQL 初始化脚本
-- Onela ORM Framework 测试数据库

-- 创建测试表
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    name VARCHAR(100) NOT NULL COMMENT '用户名',
    email VARCHAR(255) COMMENT '邮箱',
    age INT DEFAULT 0 COMMENT '年龄',
    status TINYINT DEFAULT 1 COMMENT '状态: 1=正常, 0=禁用',
    balance DECIMAL(10, 2) DEFAULT 0.00 COMMENT '余额',
    profile JSON COMMENT '用户资料',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    user_id INT NOT NULL COMMENT '用户ID',
    order_no VARCHAR(50) NOT NULL UNIQUE COMMENT '订单号',
    amount DECIMAL(10, 2) NOT NULL COMMENT '订单金额',
    status TINYINT DEFAULT 0 COMMENT '状态: 0=待支付, 1=已支付, 2=已完成, 3=已取消',
    items JSON COMMENT '订单项',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_user_id (user_id),
    INDEX idx_order_no (order_no),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT '商品ID',
    name VARCHAR(200) NOT NULL COMMENT '商品名称',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格',
    stock INT DEFAULT 0 COMMENT '库存',
    category VARCHAR(50) COMMENT '分类',
    tags JSON COMMENT '标签',
    is_active TINYINT DEFAULT 1 COMMENT '是否上架',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_category (category),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品表';

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
