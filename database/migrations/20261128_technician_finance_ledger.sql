-- MUTQAN technician finance: cash custody, spare-part purchases, expenses, settlements.
-- Additive only: no existing request, technician, customer or pricing row is changed or deleted.
-- Apply ONCE after 20261125_service_pricing_catalog_vat.sql. Test on a staging copy first.

-- 1) Per-technician financial profile (pay model + permissions controlled by the owner).
CREATE TABLE IF NOT EXISTS mutqan_tech_finance_profiles (
  user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  pay_model ENUM('monthly','commission') NOT NULL DEFAULT 'commission',
  company_share_cash DECIMAL(5,2) NOT NULL DEFAULT 25.00,      -- company % when the customer pays cash (commission model)
  company_share_transfer DECIMAL(5,2) NOT NULL DEFAULT 20.00,  -- company % when paid by transfer/card to company accounts
  monthly_salary DECIMAL(12,2) NULL,
  custody_limit DECIMAL(12,2) NOT NULL DEFAULT 0,              -- max cash the technician may hold before settling (0 = no limit)
  can_buy_parts TINYINT(1) NOT NULL DEFAULT 0,                 -- parts deducted from cash (default on for monthly only)
  can_add_expenses TINYINT(1) NOT NULL DEFAULT 0,              -- fuel / meals / other
  can_edit_prices TINYINT(1) NOT NULL DEFAULT 1,               -- issue a new quote after inspection
  can_edit_orders TINYINT(1) NOT NULL DEFAULT 1,
  can_suggest_catalog TINYINT(1) NOT NULL DEFAULT 1,           -- propose new parts / prices (pending approval)
  permission_level TINYINT UNSIGNED NOT NULL DEFAULT 1,        -- 1..10
  is_frozen TINYINT(1) NOT NULL DEFAULT 0,
  effective_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- History of every profile change, with the date it takes effect. Past ledger rows keep their own snapshot.
CREATE TABLE IF NOT EXISTS mutqan_tech_finance_profile_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  old_json JSON NULL,
  new_json JSON NOT NULL,
  effective_from DATETIME NOT NULL,
  changed_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tfph_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Cash the customer chose to pay in cash. "expected" is NOT money in hand until confirmed.
CREATE TABLE IF NOT EXISTS mutqan_cash_collections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  technician_user_id INT UNSIGNED NOT NULL,
  expected_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  received_amount DECIMAL(12,2) NULL,
  status ENUM('expected','received','disputed','cancelled') NOT NULL DEFAULT 'expected',
  confirmed_by INT UNSIGNED NULL,
  confirmed_at DATETIME NULL,
  note VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cash_request (request_id),
  KEY idx_cash_tech (technician_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) Purchases (spare parts) and expenses (fuel, meals, other) with invoice + part photos.
CREATE TABLE IF NOT EXISTS mutqan_tech_expenses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  technician_user_id INT UNSIGNED NOT NULL,
  request_id INT NULL,
  expense_type ENUM('spare_part','fuel','meal','other') NOT NULL,
  meal_kind ENUM('breakfast','lunch','dinner') NULL,
  catalog_item_id BIGINT UNSIGNED NULL,
  item_name VARCHAR(180) NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  purchase_price DECIMAL(12,2) NOT NULL,          -- what the technician paid (deducted when approved)
  sale_price DECIMAL(12,2) NULL,                  -- price charged to the customer (shown in order profit, never deducted)
  paid_from ENUM('cash_on_hand','own_pocket') NOT NULL DEFAULT 'cash_on_hand',
  invoice_image_path VARCHAR(255) NULL,
  invoice_sha256 CHAR(64) NULL,
  part_image_path VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  pay_model_snapshot ENUM('monthly','commission') NOT NULL,
  status ENUM('new','under_review','approved','rejected') NOT NULL DEFAULT 'new',
  reviewed_by INT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  review_note VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_expense_invoice_hash (invoice_sha256),   -- the same invoice photo cannot be claimed twice
  KEY idx_expense_tech (technician_user_id, status, created_at),
  KEY idx_expense_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) Settlements: the technician hands over cash, or the company pays him what it owes.
CREATE TABLE IF NOT EXISTS mutqan_tech_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  technician_user_id INT UNSIGNED NOT NULL,
  balance_before DECIMAL(12,2) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  direction ENUM('tech_to_company','company_to_tech') NOT NULL,
  method VARCHAR(60) NOT NULL DEFAULT 'cash',
  note VARCHAR(500) NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_settle_tech (technician_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) The single ledger. Positive amount = technician owes the company; negative = company owes the technician.
--    UNIQUE(source_type, source_id, entry_type) guarantees nothing is deducted twice.
CREATE TABLE IF NOT EXISTS mutqan_tech_ledger (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  technician_user_id INT UNSIGNED NOT NULL,
  entry_type ENUM('cash_received','technician_share','part_purchase','expense','adjustment','settlement') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  request_id INT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  pay_model_snapshot ENUM('monthly','commission') NOT NULL,
  description VARCHAR(255) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ledger_source (source_type, source_id, entry_type),
  KEY idx_ledger_tech (technician_user_id, created_at),
  KEY idx_ledger_request (request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) Catalogue: purchase price + technician suggestions that need approval before becoming public prices.
ALTER TABLE mutqan_price_catalog
  ADD COLUMN purchase_price DECIMAL(12,2) NULL AFTER base_price,
  ADD COLUMN approval_status ENUM('approved','pending','rejected') NOT NULL DEFAULT 'approved',
  ADD COLUMN suggested_by INT UNSIGNED NULL;

-- 7) Request payment method + device type chosen by the technician after inspection.
ALTER TABLE system_3_requests
  ADD COLUMN payment_method ENUM('cash','transfer','card','link','unknown') NOT NULL DEFAULT 'unknown';

-- 8) Owner-editable customer disclaimer for approximate prices.
ALTER TABLE mutqan_pricing_settings
  ADD COLUMN price_disclaimer VARCHAR(600) NOT NULL DEFAULT 'الأسعار المعروضة تقريبية واسترشادية وليست ملزمة؛ تختلف حسب نوع الجهاز وحجمه (سبليت 18/24/30/36، ضغط، كونسيلد، باكيج، مركزي، تشيلر) وحالته وقطع الغيار وأسعار السوق. يحدد الفني السعر النهائي بعد المعاينة ولا تعتمد أي زيادة إلا بموافقتك.',
  ADD COLUMN show_price_disclaimer TINYINT(1) NOT NULL DEFAULT 1;

-- 9) Default profiles for existing technicians (commission, the safer default). Owner switches monthly technicians.
INSERT INTO mutqan_tech_finance_profiles (user_id, pay_model)
SELECT u.id, 'commission' FROM app_users u
WHERE u.role = 'technician'
  AND NOT EXISTS (SELECT 1 FROM mutqan_tech_finance_profiles p WHERE p.user_id = u.id);

-- 10) Approximate A/C ranges requested by the owner — editable/removable from the price-book page.
INSERT IGNORE INTO mutqan_service_price_ranges (service_key, issue_key, issue_label, min_price, max_price) VALUES
 ('ac','inspection','فحص وتشخيص',50,100),
 ('ac','freon','شحن فريون',200,350),
 ('ac','wash','غسيل مكيف',100,230),
 ('ac','compressor','تغيير كمبروسر',300,450);
