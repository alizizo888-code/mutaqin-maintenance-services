-- MUTQAN role-based portals and guest-to-request journey.
-- Run ONCE after database/schema.sql on an existing or fresh database.
-- Demo staff passwords are temporary and each seeded account must change its password at first login.
CREATE TABLE IF NOT EXISTS app_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(190) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(25) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('client','technician','operations','owner','provider') NOT NULL,
  status ENUM('pending','active','rejected','disabled') NOT NULL DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  specialty VARCHAR(160) NULL,
  experience_years SMALLINT UNSIGNED NULL,
  service_area VARCHAR(255) NULL,
  address VARCHAR(255) NULL,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  approved_by INT UNSIGNED NULL,
  approved_at DATETIME NULL,
  UNIQUE KEY uq_app_users_username (username),
  UNIQUE KEY uq_app_users_phone (phone),
  KEY idx_app_users_role_status (role, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_users (username, full_name, password_hash, role, status, must_change_password)
VALUES
 ('ali', 'حساب العميل التجريبي', '$2y$12$45DHc5Mr0ClP/y2d46hyEe3nVf9JHFjvesxrx3l9Cb3I6yaLRKTji', 'client', 'active', 1),
 ('ali1', 'حساب الفني التجريبي', '$2y$12$0RcIWtkfBHcuH99Ejw1PJe7VGzWar6kWmODwZf6lfDNwFJmkJ5YE.', 'technician', 'active', 1),
 ('ali2', 'حساب مشرف العمليات التجريبي', '$2y$12$3zErHkzfXtjS99xnplZgcecMQOA8ErdBD2rW3rx1ACE20wZ8.W3CW', 'operations', 'active', 1),
 ('ali3', 'حساب المالك التجريبي', '$2y$12$o94AKxP8GYOAIWudwZ6lLOS9xbkfiHSzJJYqbXWfgMySPztWLZ3CK', 'owner', 'active', 1)
ON DUPLICATE KEY UPDATE username = VALUES(username);

CREATE TABLE IF NOT EXISTS app_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id BIGINT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_user_read (user_id, is_read, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_audit_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT NULL,
  details_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_entity (entity_type, entity_id, created_at),
  KEY idx_audit_actor (actor_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  sender_user_id INT UNSIGNED NULL,
  sender_name VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messages_request_time (request_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_2_technicians
  ADD COLUMN user_id INT UNSIGNED NULL,
  ADD COLUMN status ENUM('pending','available','busy','inactive') NOT NULL DEFAULT 'available',
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(10,7) NULL,
  ADD COLUMN updated_at DATETIME NULL,
  ADD UNIQUE KEY uq_technicians_user (user_id);

ALTER TABLE system_3_requests
  ADD COLUMN service_category VARCHAR(120) NOT NULL DEFAULT 'خدمات عامة',
  ADD COLUMN service_name VARCHAR(160) NOT NULL DEFAULT 'صيانة عامة',
  ADD COLUMN requester_name VARCHAR(120) NULL,
  ADD COLUMN requester_phone VARCHAR(25) NULL,
  ADD COLUMN service_address VARCHAR(255) NULL,
  ADD COLUMN latitude DECIMAL(10,7) NULL,
  ADD COLUMN longitude DECIMAL(10,7) NULL,
  ADD COLUMN maps_url VARCHAR(500) NULL,
  ADD COLUMN channel ENUM('guest','client') NOT NULL DEFAULT 'guest',
  ADD COLUMN status ENUM('new','assigned','accepted','en_route','in_progress','awaiting_approval','completed','cancelled') NOT NULL DEFAULT 'new',
  ADD COLUMN priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  ADD COLUMN created_by_user_id INT UNSIGNED NULL,
  ADD COLUMN assigned_user_id INT UNSIGNED NULL,
  ADD COLUMN guest_token_hash CHAR(64) NULL,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD KEY idx_requests_status_created (status, created_at),
  ADD KEY idx_requests_owner (created_by_user_id, created_at),
  ADD KEY idx_requests_assigned (assigned_user_id, status);

UPDATE system_3_requests
SET requester_name = COALESCE(requester_name, (SELECT c.name FROM system_1_clients c WHERE c.id = system_3_requests.client_id LIMIT 1)),
    requester_phone = COALESCE(requester_phone, (SELECT c.phone FROM system_1_clients c WHERE c.id = system_3_requests.client_id LIMIT 1)),
    service_address = COALESCE(service_address, (SELECT c.address FROM system_1_clients c WHERE c.id = system_3_requests.client_id LIMIT 1))
WHERE requester_name IS NULL OR requester_phone IS NULL OR service_address IS NULL;

-- Link pre-existing staff test accounts to the legacy technician table for the first test run.
INSERT INTO system_2_technicians (name, specialty, rating, cert_image_path, user_id, status)
SELECT u.full_name, COALESCE(u.specialty, 'صيانة عامة'), 5.00, '/uploads/technicians/pending.jpg', u.id, 'available'
FROM app_users u
WHERE u.username = 'ali1'
  AND NOT EXISTS (SELECT 1 FROM system_2_technicians t WHERE t.user_id = u.id);

INSERT INTO app_notifications (user_id, title, message, entity_type)
SELECT id, 'إعداد الحسابات التجريبية', 'غيّر كلمة المرور التجريبية فور أول تسجيل دخول قبل استخدام لوحة العمل.', 'security'
FROM app_users WHERE must_change_password = 1;
