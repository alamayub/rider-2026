CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(190) NULL,
  role VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_phone_role (phone, role),
  UNIQUE KEY uniq_email_role (email, role)
);

CREATE TABLE IF NOT EXISTS cities (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  currency VARCHAR(8) NOT NULL,
  base_fare DECIMAL(10,2) NOT NULL,
  per_km DECIMAL(10,2) NOT NULL,
  support_number VARCHAR(40) NULL,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS rides (
  id VARCHAR(36) PRIMARY KEY,
  rider_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36) NULL,
  city_id VARCHAR(36) NOT NULL,
  pickup JSON NOT NULL,
  drop_location JSON NOT NULL,
  fare DECIMAL(10,2) NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_rides_rider_id (rider_id),
  KEY idx_rides_driver_id (driver_id),
  KEY idx_rides_city_id (city_id),
  KEY idx_rides_status (status)
);

CREATE TABLE IF NOT EXISTS ride_events (
  id VARCHAR(36) PRIMARY KEY,
  ride_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_ride_events_ride_id (ride_id),
  KEY idx_ride_events_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id VARCHAR(36) PRIMARY KEY,
  city_id VARCHAR(36) NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  online BOOLEAN NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_driver_locations_city_id (city_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  ride_id VARCHAR(36) NOT NULL,
  method VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS ratings (
  id VARCHAR(36) PRIMARY KEY,
  ride_id VARCHAR(36) NOT NULL,
  from_user_id VARCHAR(36) NOT NULL,
  to_user_id VARCHAR(36) NOT NULL,
  score INT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR(36) PRIMARY KEY,
  ride_id VARCHAR(36) NULL,
  reporter_user_id VARCHAR(36) NOT NULL,
  reported_user_id VARCHAR(36) NOT NULL,
  reason VARCHAR(128) NOT NULL,
  description TEXT NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_reports_reported_user_id (reported_user_id),
  KEY idx_reports_status (status)
);

CREATE TABLE IF NOT EXISTS account_actions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action VARCHAR(24) NOT NULL,
  source VARCHAR(64) NOT NULL,
  metadata JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_account_actions_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  action VARCHAR(24) NOT NULL,
  actor_user_id VARCHAR(36) NOT NULL,
  before_state JSON NULL,
  after_state JSON NULL,
  created_at DATETIME NOT NULL,
  KEY idx_audit_logs_entity (entity_type, entity_id),
  KEY idx_audit_logs_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  discount_type VARCHAR(16) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  max_discount DECIMAL(10,2) NULL,
  min_fare DECIMAL(10,2) NOT NULL DEFAULT 0,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  usage_limit INT NOT NULL DEFAULT 0,
  used_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_coupon_code (code)
);

CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(36) PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  description TEXT NULL,
  city_id VARCHAR(36) NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id VARCHAR(36) PRIMARY KEY,
  coupon_id VARCHAR(36) NOT NULL,
  coupon_code VARCHAR(64) NOT NULL,
  ride_id VARCHAR(36) NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_coupon_redemptions_coupon_id (coupon_id),
  KEY idx_coupon_redemptions_rider_id (rider_id)
);
