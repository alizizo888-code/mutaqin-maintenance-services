-- MUTQAN service pricing, spare-parts catalogue, VAT and request quotations.
-- Additive migration: does not alter or delete existing customer, request, technician or finance records.
-- Apply once after the existing role-based portal migration.

CREATE TABLE IF NOT EXISTS mutqan_pricing_settings (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  vat_enabled TINYINT(1) NOT NULL DEFAULT 1,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  prices_include_vat TINYINT(1) NOT NULL DEFAULT 0,
  show_customer_prices TINYINT(1) NOT NULL DEFAULT 1,
  show_price_ranges TINYINT(1) NOT NULL DEFAULT 1,
  show_parts_catalog_to_customer TINYINT(1) NOT NULL DEFAULT 0,
  show_technician_prices TINYINT(1) NOT NULL DEFAULT 1,
  show_technician_catalog TINYINT(1) NOT NULL DEFAULT 1,
  updated_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO mutqan_pricing_settings (id) VALUES (1)
ON DUPLICATE KEY UPDATE id = VALUES(id);

CREATE TABLE IF NOT EXISTS mutqan_price_catalog (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(40) NOT NULL,
  item_name VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  service_key VARCHAR(160) NULL,
  item_type ENUM('spare_part','service','installation','labor','other') NOT NULL DEFAULT 'spare_part',
  unit_name VARCHAR(40) NOT NULL DEFAULT 'قطعة',
  base_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  vat_exempt TINYINT(1) NOT NULL DEFAULT 0,
  min_price DECIMAL(12,2) NULL,
  max_price DECIMAL(12,2) NULL,
  visible_to_customer TINYINT(1) NOT NULL DEFAULT 1,
  visible_to_technician TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mutqan_item_code (item_code),
  KEY idx_mutqan_catalog_service (service_key, is_active),
  KEY idx_mutqan_catalog_category (category, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mutqan_service_price_ranges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  service_key VARCHAR(160) NOT NULL,
  issue_key VARCHAR(160) NOT NULL,
  issue_label VARCHAR(180) NOT NULL,
  min_price DECIMAL(12,2) NOT NULL,
  max_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mutqan_issue_range (service_key, issue_key),
  KEY idx_mutqan_ranges_service (service_key, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mutqan_request_quotes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  version_no INT UNSIGNED NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  status ENUM('pending_customer','approved','rejected','superseded','cancelled') NOT NULL DEFAULT 'pending_customer',
  currency CHAR(3) NOT NULL DEFAULT 'SAR',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  customer_note VARCHAR(1000) NULL,
  customer_decided_by INT UNSIGNED NULL,
  customer_decided_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_mutqan_quote_request (request_id, version_no),
  KEY idx_mutqan_quote_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mutqan_request_quote_lines (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_id BIGINT UNSIGNED NOT NULL,
  catalog_item_id BIGINT UNSIGNED NULL,
  item_code VARCHAR(40) NULL,
  item_name VARCHAR(180) NOT NULL,
  description VARCHAR(500) NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  vat_exempt TINYINT(1) NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(12,2) NOT NULL,
  line_vat DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_mutqan_quote_lines (quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
