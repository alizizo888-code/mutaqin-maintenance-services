-- Version: v1.0 - Metqan Modular Database Schema (5 Separated Systems)

CREATE TABLE system_1_clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    phone VARCHAR(25) NOT NULL,
    address VARCHAR(255) NOT NULL,
    avatar_image_path VARCHAR(255) NOT NULL
);

CREATE TABLE system_2_technicians (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    specialty VARCHAR(150) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 5.00,
    cert_image_path VARCHAR(255) NOT NULL
);

CREATE TABLE system_3_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    tech_id INT,
    issue TEXT NOT NULL,
    before_img VARCHAR(255) NOT NULL,
    after_img VARCHAR(255)
);

CREATE TABLE system_4_services (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    icon_path VARCHAR(255) NOT NULL,
    category_id INT NOT NULL
);

CREATE TABLE system_5_invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    pdf_path VARCHAR(255) NOT NULL,
    signature_img VARCHAR(255) NOT NULL
);

CREATE TABLE image_data_bindings (
    image_id VARCHAR(64) PRIMARY KEY,
    owner_type ENUM('client','technician','request','service','invoice') NOT NULL,
    owner_id INT NOT NULL,
    local_path VARCHAR(255) NOT NULL,
    hash_sha256 CHAR(64) NOT NULL,
    uploaded_at DATETIME NOT NULL,
    uploaded_by VARCHAR(64) NOT NULL,
    no_external_source BOOLEAN DEFAULT TRUE
);