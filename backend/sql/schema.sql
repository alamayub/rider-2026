CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NULL,
  auth_otp VARCHAR(8) NULL,
  auth_otp_expires_at DATETIME NULL,
  auth_otp_last_sent_at DATETIME NULL,
  auth_otp_window_started_at DATETIME NULL,
  auth_otp_window_count INT NOT NULL DEFAULT 0,
  failed_otp_count INT NOT NULL DEFAULT 0,
  otp_locked_until DATETIME NULL,
  failed_signin_count INT NOT NULL DEFAULT 0,
  signin_locked_until DATETIME NULL,
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
  vehicle_type_id VARCHAR(36) NULL,
  ride_start_otp VARCHAR(8) NOT NULL,
  ride_start_otp_verified_at DATETIME NULL,
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

CREATE TABLE IF NOT EXISTS parcels (
  id VARCHAR(36) PRIMARY KEY,
  sender_user_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36) NULL,
  city_id VARCHAR(36) NOT NULL,
  pickup JSON NOT NULL,
  drop_location JSON NOT NULL,
  sender_name VARCHAR(160) NULL,
  sender_phone VARCHAR(32) NULL,
  receiver_name VARCHAR(160) NOT NULL,
  receiver_phone VARCHAR(32) NOT NULL,
  receiver_email VARCHAR(190) NULL,
  receiver_address VARCHAR(255) NULL,
  item_description VARCHAR(255) NOT NULL,
  weight_kg DECIMAL(10,2) NOT NULL,
  fare DECIMAL(10,2) NOT NULL,
  vehicle_type_id VARCHAR(36) NULL,
  handoff_otp VARCHAR(8) NOT NULL,
  pickup_otp_verified_at DATETIME NULL,
  drop_otp_verified_at DATETIME NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_parcels_sender (sender_user_id),
  KEY idx_parcels_driver (driver_id),
  KEY idx_parcels_status (status)
);

CREATE TABLE IF NOT EXISTS parcel_events (
  id VARCHAR(36) PRIMARY KEY,
  parcel_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_parcel_events_parcel (parcel_id),
  KEY idx_parcel_events_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS vehicle_types (
  id VARCHAR(36) PRIMARY KEY,
  code VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  capacity INT NOT NULL,
  fare_multiplier DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_vehicle_type_code (code)
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
  provider VARCHAR(32) NOT NULL DEFAULT 'esewa',
  status VARCHAR(24) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  provider_order_id VARCHAR(128) NULL,
  provider_payment_id VARCHAR(128) NULL,
  provider_metadata JSON NULL,
  failure_code VARCHAR(64) NULL,
  failure_reason VARCHAR(255) NULL,
  refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_events (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_payment_events_payment (payment_id),
  KEY idx_payment_events_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS payment_refunds (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NULL,
  status VARCHAR(24) NOT NULL,
  provider_refund_id VARCHAR(128) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_payment_refunds_payment (payment_id),
  KEY idx_payment_refunds_status (status)
);

CREATE TABLE IF NOT EXISTS payment_webhooks (
  id VARCHAR(36) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  event_id VARCHAR(128) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payment_id VARCHAR(36) NULL,
  payload JSON NOT NULL,
  processed_at DATETIME NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_webhook_provider_event (provider, event_id)
);

CREATE TABLE IF NOT EXISTS payout_ledger (
  id VARCHAR(36) PRIMARY KEY,
  payment_id VARCHAR(36) NOT NULL,
  driver_id VARCHAR(36) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(8) NOT NULL DEFAULT 'INR',
  status VARCHAR(24) NOT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_payout_ledger_driver (driver_id),
  KEY idx_payout_ledger_status (status),
  KEY idx_payout_ledger_payment (payment_id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id VARCHAR(36) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  method_code VARCHAR(64) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  category VARCHAR(32) NOT NULL,
  app_scopes JSON NOT NULL,
  countries JSON NOT NULL,
  currencies JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_payment_provider_method (provider, method_code)
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
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_rating_direction (ride_id, from_user_id, to_user_id)
);

CREATE TABLE IF NOT EXISTS user_rating_stats (
  user_id VARCHAR(36) PRIMARY KEY,
  total_received_ratings INT NOT NULL DEFAULT 0,
  total_received_score INT NOT NULL DEFAULT 0,
  average_received_rating DECIMAL(5,2) NOT NULL DEFAULT 0,
  last_rated_at DATETIME NULL,
  updated_at DATETIME NOT NULL
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

CREATE TABLE IF NOT EXISTS penalties (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  ride_id VARCHAR(36) NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_penalties_user_id (user_id),
  KEY idx_penalties_status (status)
);

CREATE TABLE IF NOT EXISTS driver_daily_stats (
  stat_date DATE NOT NULL,
  driver_id VARCHAR(36) NOT NULL,
  total_rides INT NOT NULL DEFAULT 0,
  completed_rides INT NOT NULL DEFAULT 0,
  cancelled_rides INT NOT NULL DEFAULT 0,
  gross_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_given DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalties_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_earnings DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (stat_date, driver_id)
);

CREATE TABLE IF NOT EXISTS rider_daily_stats (
  stat_date DATE NOT NULL,
  rider_id VARCHAR(36) NOT NULL,
  total_rides INT NOT NULL DEFAULT 0,
  completed_rides INT NOT NULL DEFAULT 0,
  cancelled_rides INT NOT NULL DEFAULT 0,
  total_spent DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_savings DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalties_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (stat_date, rider_id)
);

CREATE TABLE IF NOT EXISTS admin_daily_stats (
  stat_date DATE NOT NULL PRIMARY KEY,
  total_rides INT NOT NULL DEFAULT 0,
  completed_rides INT NOT NULL DEFAULT 0,
  cancelled_rides INT NOT NULL DEFAULT 0,
  gross_bookings DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_earned DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalties_collected DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_platform_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  participant_a_id VARCHAR(36) NOT NULL,
  participant_b_id VARCHAR(36) NOT NULL,
  ride_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_conversation_pair (participant_a_id, participant_b_id, ride_id),
  KEY idx_conversations_participant_a (participant_a_id),
  KEY idx_conversations_participant_b (participant_b_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_messages_conversation (conversation_id),
  KEY idx_messages_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  recipient_user_id VARCHAR(36) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  payload JSON NULL,
  channel VARCHAR(32) NOT NULL,
  status VARCHAR(24) NOT NULL,
  sent_at DATETIME NOT NULL,
  received_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  KEY idx_notifications_recipient (recipient_user_id),
  KEY idx_notifications_status (status),
  KEY idx_notifications_created_at (created_at)
);

CREATE TABLE IF NOT EXISTS user_device_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  app VARCHAR(32) NOT NULL,
  platform VARCHAR(16) NOT NULL,
  token VARCHAR(512) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_user_device_token (user_id, token),
  KEY idx_device_tokens_user (user_id),
  KEY idx_device_tokens_active (is_active)
);

CREATE TABLE IF NOT EXISTS driver_vehicles (
  id VARCHAR(36) PRIMARY KEY,
  driver_id VARCHAR(36) NOT NULL,
  vehicle_type_id VARCHAR(36) NOT NULL,
  plate_number VARCHAR(32) NOT NULL,
  model_name VARCHAR(120) NULL,
  color VARCHAR(64) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_driver_plate (driver_id, plate_number),
  KEY idx_driver_vehicle_driver (driver_id),
  KEY idx_driver_vehicle_type (vehicle_type_id)
);

CREATE TABLE IF NOT EXISTS driver_kyc_records (
  id VARCHAR(36) PRIMARY KEY,
  driver_id VARCHAR(36) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  license_number VARCHAR(80) NOT NULL,
  document_url VARCHAR(512) NULL,
  status VARCHAR(24) NOT NULL,
  rejection_reason TEXT NULL,
  reviewed_by VARCHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  created_by VARCHAR(36) NOT NULL,
  updated_by VARCHAR(36) NOT NULL,
  UNIQUE KEY uniq_driver_kyc (driver_id),
  KEY idx_driver_kyc_status (status)
);
