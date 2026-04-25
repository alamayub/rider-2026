import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import cityConfigs from '../config/cities.json' with { type: 'json' };
import { env } from '../config/env.js';

const now = () => new Date().toISOString();
const createId = () => randomUUID();

let pool = null;

const vehicleTypeConfigs = [
  { id: 'vt-bike', code: 'bike', name: 'Bike', capacity: 1, fareMultiplier: 0.7, isActive: true },
  { id: 'vt-auto', code: 'auto', name: 'Auto', capacity: 3, fareMultiplier: 0.85, isActive: true },
  { id: 'vt-cab', code: 'cab', name: 'Cab', capacity: 4, fareMultiplier: 1, isActive: true },
  { id: 'vt-premium', code: 'premium', name: 'Premium', capacity: 4, fareMultiplier: 1.5, isActive: true },
  { id: 'vt-seater4', code: 'seater4', name: '4 Seater', capacity: 4, fareMultiplier: 1.1, isActive: true },
  { id: 'vt-seater6', code: 'seater6', name: '6 Seater', capacity: 6, fareMultiplier: 1.35, isActive: true }
];

const paymentMethodConfigs = [
  {
    id: 'pm-esewa-wallet',
    provider: 'esewa',
    methodCode: 'wallet',
    displayName: 'eSewa Wallet',
    category: 'wallet',
    appScopes: ['rider', 'driver'],
    countries: ['np'],
    currencies: ['NPR'],
    isActive: true,
    sortOrder: 10
  },
  {
    id: 'pm-khalti-wallet',
    provider: 'khalti',
    methodCode: 'wallet',
    displayName: 'Khalti Wallet',
    category: 'wallet',
    appScopes: ['rider', 'driver'],
    countries: ['np'],
    currencies: ['NPR'],
    isActive: true,
    sortOrder: 20
  },
  {
    id: 'pm-fonepay-wallet',
    provider: 'fonepay',
    methodCode: 'wallet',
    displayName: 'Fonepay',
    category: 'wallet',
    appScopes: ['rider', 'driver'],
    countries: ['np'],
    currencies: ['NPR'],
    isActive: true,
    sortOrder: 30
  },
  {
    id: 'pm-connectips-bank',
    provider: 'connectips',
    methodCode: 'bank_transfer',
    displayName: 'ConnectIPS',
    category: 'bank',
    appScopes: ['rider', 'driver', 'admin'],
    countries: ['np'],
    currencies: ['NPR'],
    isActive: true,
    sortOrder: 40
  }
];

const memory = {
  users: [],
  rides: [],
  parcels: [],
  parcelEvents: [],
  rideEvents: [],
  driverLocations: [],
  driverVehicles: [],
  driverKycRecords: [],
  ratings: [],
  userRatingStats: [],
  payments: [],
  paymentEvents: [],
  paymentRefunds: [],
  paymentWebhooks: [],
  payoutLedger: [],
  paymentMethods: paymentMethodConfigs.map((m) => ({ ...m })),
  coupons: [],
  offers: [],
  couponRedemptions: [],
  penalties: [],
  conversations: [],
  messages: [],
  notifications: [],
  userDeviceTokens: [],
  vehicleTypes: vehicleTypeConfigs.map((v) => ({ ...v })),
  driverDailyStats: [],
  riderDailyStats: [],
  adminDailyStats: [],
  reports: [],
  accountActions: [],
  auditLogs: [],
  cities: [...cityConfigs]
};

function actorOrSystem(actorUserId) {
  return actorUserId || 'system';
}

function dayKey(dateValue) {
  return new Date(dateValue).toISOString().slice(0, 10);
}

function toNum(value) {
  return Number(value || 0);
}

function commissionAmount(fare) {
  return Math.round((toNum(fare) * env.commissionRatePercent) / 100);
}

function upsertMemoryStat(rows, matcher, seed, delta) {
  const existing = rows.find(matcher);
  if (!existing) {
    rows.push({ ...seed, ...delta });
    return;
  }
  for (const [key, value] of Object.entries(delta)) {
    existing[key] = toNum(existing[key]) + toNum(value);
  }
}

function mergeDelta(a = {}, b = {}) {
  const out = {};
  for (const [k, v] of Object.entries(a)) out[k] = toNum(v);
  for (const [k, v] of Object.entries(b)) out[k] = toNum(out[k]) + toNum(v);
  return out;
}

function parseJson(value, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeRide(row) {
  if (!row) return null;

  return {
    id: row.id,
    riderId: row.rider_id,
    driverId: row.driver_id,
    cityId: row.city_id,
    pickup: parseJson(row.pickup, null),
    drop: parseJson(row.drop_location, null),
    fare: Number(row.fare),
    vehicleTypeId: row.vehicle_type_id || null,
    rideStartOtp: row.ride_start_otp || null,
    rideStartOtpVerifiedAt: row.ride_start_otp_verified_at || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normalizeParcel(row) {
  if (!row) return null;

  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    driverId: row.driver_id,
    cityId: row.city_id,
    pickup: parseJson(row.pickup, null),
    drop: parseJson(row.drop_location, null),
    senderName: row.sender_name || null,
    senderPhone: row.sender_phone || null,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    receiverEmail: row.receiver_email || null,
    receiverAddress: row.receiver_address || null,
    itemDescription: row.item_description,
    weightKg: Number(row.weight_kg),
    fare: Number(row.fare),
    vehicleTypeId: row.vehicle_type_id || null,
    handoffOtp: row.handoff_otp || null,
    pickupOtpVerifiedAt: row.pickup_otp_verified_at || null,
    dropOtpVerifiedAt: row.drop_otp_verified_at || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function migrateMySql() {
  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE users MODIFY phone VARCHAR(32) NOT NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(190) NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_otp VARCHAR(8) NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_otp_expires_at DATETIME NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_otp_last_sent_at DATETIME NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_otp_window_started_at DATETIME NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_otp_window_count INT NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_otp_count INT NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_locked_until DATETIME NULL');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_signin_count INT NOT NULL DEFAULT 0');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS signin_locked_until DATETIME NULL');
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_role ON users (email, role)');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'");
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cities (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      currency VARCHAR(8) NOT NULL,
      base_fare DECIMAL(10,2) NOT NULL,
      per_km DECIMAL(10,2) NOT NULL,
      support_number VARCHAR(40) NULL,
      tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0
      ,created_at DATETIME NOT NULL
      ,updated_at DATETIME NOT NULL
      ,created_by VARCHAR(36) NOT NULL
      ,updated_by VARCHAR(36) NOT NULL
    )
  `);
  await pool.query('ALTER TABLE cities ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL');
  await pool.query('ALTER TABLE cities ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE cities ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE cities ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS vehicle_type_id VARCHAR(36) NULL');
  await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_start_otp VARCHAR(8) NOT NULL DEFAULT '000000'");
  await pool.query('ALTER TABLE rides ADD COLUMN IF NOT EXISTS ride_start_otp_verified_at DATETIME NULL');
  await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
    )
  `);
  await pool.query("ALTER TABLE parcels ADD COLUMN IF NOT EXISTS handoff_otp VARCHAR(8) NOT NULL DEFAULT '000000'");
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS pickup_otp_verified_at DATETIME NULL');
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS drop_otp_verified_at DATETIME NULL');
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS sender_name VARCHAR(160) NULL');
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(32) NULL');
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_email VARCHAR(190) NULL');
  await pool.query('ALTER TABLE parcels ADD COLUMN IF NOT EXISTS receiver_address VARCHAR(255) NULL');

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE ride_events ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE ride_events ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE ride_events ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS driver_locations (
      driver_id VARCHAR(36) PRIMARY KEY,
      city_id VARCHAR(36) NOT NULL,
      lat DOUBLE NOT NULL,
      lng DOUBLE NOT NULL,
      online BOOLEAN NOT NULL,
      updated_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      created_by VARCHAR(36) NOT NULL,
      updated_by VARCHAR(36) NOT NULL,
      KEY idx_driver_locations_city_id (city_id)
    )
  `);
  await pool.query('ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS created_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE driver_locations ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
      updated_at DATETIME NULL,
      created_by VARCHAR(36) NOT NULL,
      updated_by VARCHAR(36) NOT NULL
    )
  `);
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'INR'");
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'esewa'");
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_order_id VARCHAR(128) NULL');
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_payment_id VARCHAR(128) NULL');
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_metadata JSON NULL');
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_code VARCHAR(64) NULL');
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(255) NULL');
  await pool.query('ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);
  await pool.query("ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS app_scopes JSON NOT NULL");

  const [existingPaymentMethods] = await pool.query('SELECT COUNT(*) AS count FROM payment_methods');
  if (existingPaymentMethods[0].count === 0) {
    for (const method of paymentMethodConfigs) {
      const ts = now();
      await pool.query(
        `INSERT INTO payment_methods (id, provider, method_code, display_name, category, app_scopes, countries, currencies, is_active, sort_order, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          method.id,
          method.provider,
          method.methodCode,
          method.displayName,
          method.category,
          JSON.stringify(method.appScopes),
          JSON.stringify(method.countries),
          JSON.stringify(method.currencies),
          method.isActive,
          method.sortOrder,
          ts,
          ts,
          'system',
          'system'
        ]
      );
    }
  }

  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_rating_direction ON ratings (ride_id, from_user_id, to_user_id)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_rating_stats (
      user_id VARCHAR(36) PRIMARY KEY,
      total_received_ratings INT NOT NULL DEFAULT 0,
      total_received_score INT NOT NULL DEFAULT 0,
      average_received_rating DECIMAL(5,2) NOT NULL DEFAULT 0,
      last_rated_at DATETIME NULL,
      updated_at DATETIME NOT NULL
    )
  `);

  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE reports ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
    )
  `);
  await pool.query('ALTER TABLE account_actions ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE account_actions ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE account_actions ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  await pool.query(`
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
    )
  `);

  const [existingVehicleTypes] = await pool.query('SELECT COUNT(*) AS count FROM vehicle_types');
  if (existingVehicleTypes[0].count === 0) {
    for (const vt of vehicleTypeConfigs) {
      const ts = now();
      await pool.query(
        `INSERT INTO vehicle_types (code, name, capacity, fare_multiplier, is_active, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vt.id, vt.code, vt.name, vt.capacity, vt.fareMultiplier, vt.isActive, ts, ts, 'system', 'system']
      );
    }
  }

  const [existingCities] = await pool.query('SELECT COUNT(*) AS count FROM cities');
  if (existingCities[0].count === 0) {
    for (const city of cityConfigs) {
      const seedTs = now();
      await pool.query(
        'INSERT INTO cities (id, name, currency, base_fare, per_km, support_number, tax_percent, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [city.id, city.name, city.currency, city.baseFare, city.perKm, city.supportNumber || null, city.taxPercent ?? 0, seedTs, seedTs, 'system', 'system']
      );
    }
  }
}

export async function initDb() {
  if (env.dbClient !== 'mysql') {
    throw new Error('Only MySQL is supported. In-memory mode has been removed.');
  }
  if (pool) return;

  pool = mysql.createPool({
    host: env.mysql.host,
    port: env.mysql.port,
    user: env.mysql.user,
    password: env.mysql.password,
    database: env.mysql.database,
    waitForConnections: true,
    connectionLimit: 10
  });

  await migrateMySql();
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function findUserByPhoneRole(phone, role) {
  if (env.dbClient === 'memory') {
    return memory.users.find((u) => u.phone === phone && u.role === role) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, phone, email, password_hash AS passwordHash, auth_otp AS authOtp, auth_otp_expires_at AS authOtpExpiresAt,
            auth_otp_last_sent_at AS authOtpLastSentAt, auth_otp_window_started_at AS authOtpWindowStartedAt, auth_otp_window_count AS authOtpWindowCount,
            failed_otp_count AS failedOtpCount, otp_locked_until AS otpLockedUntil,
            failed_signin_count AS failedSigninCount, signin_locked_until AS signinLockedUntil,
            role, status, created_at AS createdAt
     FROM users WHERE phone = ? AND role = ? LIMIT 1`,
    [phone, role]
  );
  return rows[0] || null;
}

export async function createUser({ phone, email, role, passwordHash = null }) {
  const ts = now();
  const user = {
    id: createId(),
    phone,
    email: email || null,
    passwordHash,
    authOtp: null,
    authOtpExpiresAt: null,
    authOtpLastSentAt: null,
    authOtpWindowStartedAt: null,
    authOtpWindowCount: 0,
    failedOtpCount: 0,
    otpLockedUntil: null,
    failedSigninCount: 0,
    signinLockedUntil: null,
    role,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
    createdBy: 'system',
    updatedBy: 'system'
  };

  if (env.dbClient === 'memory') {
    memory.users.push(user);
    return user;
  }

  await pool.query(
    `INSERT INTO users (
      id, phone, email, password_hash, auth_otp, auth_otp_expires_at, auth_otp_last_sent_at, auth_otp_window_started_at, auth_otp_window_count,
      failed_otp_count, otp_locked_until, failed_signin_count, signin_locked_until, role, status, created_at, updated_at, created_by, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
    user.id,
    user.phone,
    user.email,
    user.passwordHash,
    user.authOtp,
    user.authOtpExpiresAt,
    user.authOtpLastSentAt,
    user.authOtpWindowStartedAt,
    user.authOtpWindowCount,
    user.failedOtpCount,
    user.otpLockedUntil,
    user.failedSigninCount,
    user.signinLockedUntil,
    user.role,
    user.status,
    user.createdAt,
    user.updatedAt,
    user.createdBy,
    user.updatedBy
  ]);
  await createAuditLogRecord({ entityType: 'user', entityId: user.id, action: 'create', actorUserId: 'system', beforeState: null, afterState: user });
  return user;
}

export async function findUserById(userId) {
  if (env.dbClient === 'memory') {
    return memory.users.find((u) => u.id === userId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, phone, email, password_hash AS passwordHash, auth_otp AS authOtp, auth_otp_expires_at AS authOtpExpiresAt,
            auth_otp_last_sent_at AS authOtpLastSentAt, auth_otp_window_started_at AS authOtpWindowStartedAt, auth_otp_window_count AS authOtpWindowCount,
            failed_otp_count AS failedOtpCount, otp_locked_until AS otpLockedUntil,
            failed_signin_count AS failedSigninCount, signin_locked_until AS signinLockedUntil,
            role, status, created_at AS createdAt
     FROM users WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

export async function setUserAuthOtp({ userId, otp, expiresAt, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    user.authOtp = otp;
    user.authOtpExpiresAt = expiresAt;
    user.authOtpLastSentAt = updatedAt;
    user.updatedAt = updatedAt;
    user.updatedBy = actorId;
    return user;
  }

  await pool.query('UPDATE users SET auth_otp = ?, auth_otp_expires_at = ?, auth_otp_last_sent_at = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
    otp,
    expiresAt,
    updatedAt,
    updatedAt,
    actorId,
    userId
  ]);
  return findUserById(userId);
}

export async function clearUserAuthOtp({ userId, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    user.authOtp = null;
    user.authOtpExpiresAt = null;
    user.updatedAt = updatedAt;
    user.updatedBy = actorId;
    return user;
  }

  await pool.query('UPDATE users SET auth_otp = NULL, auth_otp_expires_at = NULL, updated_at = ?, updated_by = ? WHERE id = ?', [updatedAt, actorId, userId]);
  return findUserById(userId);
}

export async function updateUserOtpWindow({ userId, windowStartedAt, windowCount, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    user.authOtpWindowStartedAt = windowStartedAt;
    user.authOtpWindowCount = Number(windowCount || 0);
    user.updatedAt = updatedAt;
    user.updatedBy = actorId;
    return user;
  }

  await pool.query('UPDATE users SET auth_otp_window_started_at = ?, auth_otp_window_count = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
    windowStartedAt,
    windowCount,
    updatedAt,
    actorId,
    userId
  ]);
  return findUserById(userId);
}

export async function updateUserSignInGuard({ userId, failedSigninCount, signinLockedUntil, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    user.failedSigninCount = Number(failedSigninCount || 0);
    user.signinLockedUntil = signinLockedUntil || null;
    user.updatedAt = updatedAt;
    user.updatedBy = actorId;
    return user;
  }

  await pool.query('UPDATE users SET failed_signin_count = ?, signin_locked_until = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
    failedSigninCount,
    signinLockedUntil,
    updatedAt,
    actorId,
    userId
  ]);
  return findUserById(userId);
}

export async function updateUserOtpGuard({ userId, failedOtpCount, otpLockedUntil, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    user.failedOtpCount = Number(failedOtpCount || 0);
    user.otpLockedUntil = otpLockedUntil || null;
    user.updatedAt = updatedAt;
    user.updatedBy = actorId;
    return user;
  }

  await pool.query('UPDATE users SET failed_otp_count = ?, otp_locked_until = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
    failedOtpCount,
    otpLockedUntil,
    updatedAt,
    actorId,
    userId
  ]);
  return findUserById(userId);
}

export async function updateUserStatus(userId, status) {
  if (env.dbClient === 'memory') {
    const user = memory.users.find((u) => u.id === userId);
    if (!user) return null;
    const before = { ...user };
    user.status = status;
    user.updatedAt = now();
    user.updatedBy = 'system';
    memory.auditLogs.push({
      id: createId(),
      entityType: 'user',
      entityId: userId,
      action: 'update',
      actorUserId: 'system',
      beforeState: before,
      afterState: { ...user },
      createdAt: now()
    });
    return user;
  }

  const before = await findUserById(userId);
  const updatedAt = now();
  await pool.query('UPDATE users SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, updatedAt, 'system', userId]);
  const after = await findUserById(userId);
  if (after) {
    await createAuditLogRecord({ entityType: 'user', entityId: userId, action: 'update', actorUserId: 'system', beforeState: before, afterState: after });
  }
  return after;
}

export async function findCityById(cityId) {
  if (env.dbClient === 'memory') {
    return memory.cities.find((c) => c.id === cityId) || null;
  }

  const [rows] = await pool.query(
    'SELECT id, name, currency, base_fare AS baseFare, per_km AS perKm, support_number AS supportNumber, tax_percent AS taxPercent FROM cities WHERE id = ? LIMIT 1',
    [cityId]
  );
  return rows[0] || null;
}

export async function listCities() {
  if (env.dbClient === 'memory') return memory.cities;
  const [rows] = await pool.query(
    'SELECT id, name, currency, base_fare AS baseFare, per_km AS perKm, support_number AS supportNumber, tax_percent AS taxPercent FROM cities'
  );
  return rows;
}

export async function createCity(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const city = {
    id: data.id || createId(),
    name: data.name,
    currency: data.currency || 'INR',
    baseFare: data.baseFare ?? 50,
    perKm: data.perKm ?? 15,
    supportNumber: data.supportNumber || null,
    taxPercent: data.taxPercent ?? 0,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.cities.push(city);
    return city;
  }

  await pool.query(
    'INSERT INTO cities (id, name, currency, base_fare, per_km, support_number, tax_percent, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [city.id, city.name, city.currency, city.baseFare, city.perKm, city.supportNumber, city.taxPercent, city.createdAt, city.updatedAt, city.createdBy, city.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'city', entityId: city.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: city });
  return city;
}

export async function listOnlineDriverLocationsByCity(cityId, vehicleTypeId = null) {
  if (env.dbClient === 'memory') {
    const activeDriversForType = new Set(
      memory.driverVehicles
        .filter((v) => v.isActive && (!vehicleTypeId || v.vehicleTypeId === vehicleTypeId))
        .map((v) => v.driverId)
    );
    return memory.driverLocations.filter((loc) => loc.cityId === cityId && loc.online && activeDriversForType.has(loc.driverId));
  }

  const [rows] = vehicleTypeId
    ? await pool.query(
        `SELECT dl.driver_id AS driverId, dl.city_id AS cityId, dl.lat, dl.lng, dl.online, dl.updated_at AS updatedAt
         FROM driver_locations dl
         INNER JOIN driver_vehicles dv ON dv.driver_id = dl.driver_id
         WHERE dl.city_id = ? AND dl.online = true AND dv.is_active = true AND dv.vehicle_type_id = ?`,
        [cityId, vehicleTypeId]
      )
    : await pool.query(
        `SELECT dl.driver_id AS driverId, dl.city_id AS cityId, dl.lat, dl.lng, dl.online, dl.updated_at AS updatedAt
         FROM driver_locations dl
         INNER JOIN driver_vehicles dv ON dv.driver_id = dl.driver_id
         WHERE dl.city_id = ? AND dl.online = true AND dv.is_active = true`,
        [cityId]
      );

  return rows;
}

export async function upsertDriverLocation(payload) {
  const record = {
    driverId: payload.driverId,
    cityId: payload.cityId,
    lat: payload.lat,
    lng: payload.lng,
    online: Boolean(payload.online),
    updatedAt: now(),
    createdAt: now(),
    createdBy: actorOrSystem(payload.driverId),
    updatedBy: actorOrSystem(payload.driverId)
  };

  if (env.dbClient === 'memory') {
    const existing = memory.driverLocations.find((d) => d.driverId === payload.driverId);
    if (existing) Object.assign(existing, record);
    else memory.driverLocations.push(record);
    return record;
  }

  const [existing] = await pool.query('SELECT driver_id AS driverId, city_id AS cityId, lat, lng, online, updated_at AS updatedAt FROM driver_locations WHERE driver_id = ? LIMIT 1', [record.driverId]);
  await pool.query(
    `INSERT INTO driver_locations (driver_id, city_id, lat, lng, online, updated_at, created_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE city_id = VALUES(city_id), lat = VALUES(lat), lng = VALUES(lng), online = VALUES(online), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)`,
    [record.driverId, record.cityId, record.lat, record.lng, record.online, record.updatedAt, record.createdAt, record.createdBy, record.updatedBy]
  );
  await createAuditLogRecord({
    entityType: 'driver_location',
    entityId: record.driverId,
    action: existing.length ? 'update' : 'create',
    actorUserId: record.updatedBy,
    beforeState: existing[0] || null,
    afterState: record
  });

  return record;
}

async function applyDriverDailyDelta({ statDate, driverId, delta }) {
  if (!driverId) return;

  if (env.dbClient === 'memory') {
    upsertMemoryStat(
      memory.driverDailyStats,
      (r) => r.statDate === statDate && r.driverId === driverId,
      {
        statDate,
        driverId,
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        grossEarnings: 0,
        commissionGiven: 0,
        penaltiesAmount: 0,
        netEarnings: 0
      },
      delta
    );
    return;
  }

  await pool.query(
    `INSERT INTO driver_daily_stats (stat_date, driver_id, total_rides, completed_rides, cancelled_rides, gross_earnings, commission_given, penalties_amount, net_earnings, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_rides = total_rides + VALUES(total_rides),
       completed_rides = completed_rides + VALUES(completed_rides),
       cancelled_rides = cancelled_rides + VALUES(cancelled_rides),
       gross_earnings = gross_earnings + VALUES(gross_earnings),
       commission_given = commission_given + VALUES(commission_given),
       penalties_amount = penalties_amount + VALUES(penalties_amount),
       net_earnings = net_earnings + VALUES(net_earnings),
       updated_at = VALUES(updated_at)`,
    [
      statDate,
      driverId,
      toNum(delta.totalRides),
      toNum(delta.completedRides),
      toNum(delta.cancelledRides),
      toNum(delta.grossEarnings),
      toNum(delta.commissionGiven),
      toNum(delta.penaltiesAmount),
      toNum(delta.netEarnings),
      now()
    ]
  );
}

async function applyRiderDailyDelta({ statDate, riderId, delta }) {
  if (!riderId) return;

  if (env.dbClient === 'memory') {
    upsertMemoryStat(
      memory.riderDailyStats,
      (r) => r.statDate === statDate && r.riderId === riderId,
      {
        statDate,
        riderId,
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        totalSpent: 0,
        totalSavings: 0,
        penaltiesAmount: 0
      },
      delta
    );
    return;
  }

  await pool.query(
    `INSERT INTO rider_daily_stats (stat_date, rider_id, total_rides, completed_rides, cancelled_rides, total_spent, total_savings, penalties_amount, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_rides = total_rides + VALUES(total_rides),
       completed_rides = completed_rides + VALUES(completed_rides),
       cancelled_rides = cancelled_rides + VALUES(cancelled_rides),
       total_spent = total_spent + VALUES(total_spent),
       total_savings = total_savings + VALUES(total_savings),
       penalties_amount = penalties_amount + VALUES(penalties_amount),
       updated_at = VALUES(updated_at)`,
    [
      statDate,
      riderId,
      toNum(delta.totalRides),
      toNum(delta.completedRides),
      toNum(delta.cancelledRides),
      toNum(delta.totalSpent),
      toNum(delta.totalSavings),
      toNum(delta.penaltiesAmount),
      now()
    ]
  );
}

async function applyAdminDailyDelta({ statDate, delta }) {
  if (env.dbClient === 'memory') {
    upsertMemoryStat(
      memory.adminDailyStats,
      (r) => r.statDate === statDate,
      {
        statDate,
        totalRides: 0,
        completedRides: 0,
        cancelledRides: 0,
        grossBookings: 0,
        commissionEarned: 0,
        penaltiesCollected: 0,
        netPlatformRevenue: 0
      },
      delta
    );
    return;
  }

  await pool.query(
    `INSERT INTO admin_daily_stats (stat_date, total_rides, completed_rides, cancelled_rides, gross_bookings, commission_earned, penalties_collected, net_platform_revenue, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_rides = total_rides + VALUES(total_rides),
       completed_rides = completed_rides + VALUES(completed_rides),
       cancelled_rides = cancelled_rides + VALUES(cancelled_rides),
       gross_bookings = gross_bookings + VALUES(gross_bookings),
       commission_earned = commission_earned + VALUES(commission_earned),
       penalties_collected = penalties_collected + VALUES(penalties_collected),
       net_platform_revenue = net_platform_revenue + VALUES(net_platform_revenue),
       updated_at = VALUES(updated_at)`,
    [
      statDate,
      toNum(delta.totalRides),
      toNum(delta.completedRides),
      toNum(delta.cancelledRides),
      toNum(delta.grossBookings),
      toNum(delta.commissionEarned),
      toNum(delta.penaltiesCollected),
      toNum(delta.netPlatformRevenue),
      now()
    ]
  );
}

function riderStatusDelta(status, fare, sign = 1) {
  if (status === 'completed') {
    return { completedRides: sign, totalSpent: sign * toNum(fare) };
  }
  if (status === 'cancelled') {
    return { cancelledRides: sign };
  }
  return {};
}

function driverStatusDelta(status, fare, sign = 1) {
  if (status === 'completed') {
    const gross = sign * toNum(fare);
    const commission = sign * commissionAmount(fare);
    return {
      completedRides: sign,
      grossEarnings: gross,
      commissionGiven: commission,
      netEarnings: gross - commission
    };
  }
  if (status === 'cancelled') {
    return { cancelledRides: sign };
  }
  return {};
}

function adminStatusDelta(status, fare, sign = 1) {
  if (status === 'completed') {
    const gross = sign * toNum(fare);
    const commission = sign * commissionAmount(fare);
    return {
      completedRides: sign,
      grossBookings: gross,
      commissionEarned: commission,
      netPlatformRevenue: commission
    };
  }
  if (status === 'cancelled') {
    return { cancelledRides: sign };
  }
  return {};
}

async function recordRideCreatedAnalytics(ride) {
  const statDate = dayKey(ride.createdAt);
  await applyRiderDailyDelta({ statDate, riderId: ride.riderId, delta: { totalRides: 1, ...riderStatusDelta(ride.status, ride.fare, 1) } });
  if (ride.driverId) {
    await applyDriverDailyDelta({ statDate, driverId: ride.driverId, delta: { totalRides: 1, ...driverStatusDelta(ride.status, ride.fare, 1) } });
  }
  await applyAdminDailyDelta({ statDate, delta: { totalRides: 1, ...adminStatusDelta(ride.status, ride.fare, 1) } });
}

async function recordRideStatusTransitionAnalytics(beforeRide, afterRide) {
  if (!beforeRide || !afterRide || beforeRide.status === afterRide.status) return;
  const statDate = dayKey(afterRide.createdAt);

  await applyRiderDailyDelta({
    statDate,
    riderId: afterRide.riderId,
    delta: mergeDelta(riderStatusDelta(beforeRide.status, beforeRide.fare, -1), riderStatusDelta(afterRide.status, afterRide.fare, 1))
  });
  if (afterRide.driverId) {
    await applyDriverDailyDelta({
      statDate,
      driverId: afterRide.driverId,
      delta: mergeDelta(driverStatusDelta(beforeRide.status, beforeRide.fare, -1), driverStatusDelta(afterRide.status, afterRide.fare, 1))
    });
  }
  await applyAdminDailyDelta({
    statDate,
    delta: mergeDelta(adminStatusDelta(beforeRide.status, beforeRide.fare, -1), adminStatusDelta(afterRide.status, afterRide.fare, 1))
  });
}

async function recordCouponRedemptionAnalytics(redemption) {
  const statDate = dayKey(redemption.createdAt);
  await applyRiderDailyDelta({
    statDate,
    riderId: redemption.riderId,
    delta: { totalSavings: toNum(redemption.discountAmount) }
  });
}

async function recordPenaltyAnalytics(penalty) {
  const statDate = dayKey(penalty.createdAt);
  const user = await findUserById(penalty.userId);
  const amount = toNum(penalty.amount);
  if (user?.role === 'driver') {
    await applyDriverDailyDelta({
      statDate,
      driverId: penalty.userId,
      delta: { penaltiesAmount: amount, netEarnings: -amount }
    });
  } else if (user?.role === 'rider') {
    await applyRiderDailyDelta({
      statDate,
      riderId: penalty.userId,
      delta: { penaltiesAmount: amount }
    });
  }
  await applyAdminDailyDelta({
    statDate,
    delta: { penaltiesCollected: amount, netPlatformRevenue: amount }
  });
}

export async function createRideRecord({
  riderId,
  driverId,
  cityId,
  pickup,
  drop,
  fare,
  vehicleTypeId,
  rideStartOtp,
  status,
  actorUserId
}) {
  const actorId = actorOrSystem(actorUserId || riderId);
  const ts = now();
  const ride = {
    id: createId(),
    riderId,
    driverId: driverId || null,
    cityId,
    pickup,
    drop,
    fare,
    vehicleTypeId: vehicleTypeId || null,
    rideStartOtp: rideStartOtp || '000000',
    rideStartOtpVerifiedAt: null,
    status,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.rides.push(ride);
    await recordRideCreatedAnalytics(ride);
    return ride;
  }

  await pool.query(
    `INSERT INTO rides (id, rider_id, driver_id, city_id, pickup, drop_location, fare, vehicle_type_id, ride_start_otp, ride_start_otp_verified_at, status, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ride.id,
      ride.riderId,
      ride.driverId,
      ride.cityId,
      JSON.stringify(ride.pickup),
      JSON.stringify(ride.drop),
      ride.fare,
      ride.vehicleTypeId,
      ride.rideStartOtp,
      ride.rideStartOtpVerifiedAt,
      ride.status,
      ride.createdAt,
      ride.updatedAt,
      ride.createdBy,
      ride.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'ride', entityId: ride.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: ride });
  await recordRideCreatedAnalytics(ride);
  return ride;
}

export async function insertRideEvent({ rideId, type, payload, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const event = { id: createId(), rideId, type, payload, createdAt: ts, updatedAt: ts, createdBy: actorId, updatedBy: actorId };

  if (env.dbClient === 'memory') {
    memory.rideEvents.push(event);
    return event;
  }

  await pool.query('INSERT INTO ride_events (id, ride_id, type, payload, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    event.id,
    event.rideId,
    event.type,
    JSON.stringify(event.payload),
    event.createdAt,
    event.updatedAt,
    event.createdBy,
    event.updatedBy
  ]);
  await createAuditLogRecord({ entityType: 'ride_event', entityId: event.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: event });
  return event;
}

export async function findRideById(rideId) {
  if (env.dbClient === 'memory') {
    return memory.rides.find((r) => r.id === rideId) || null;
  }

  const [rows] = await pool.query(
    'SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, vehicle_type_id, ride_start_otp, ride_start_otp_verified_at, status, created_at, updated_at FROM rides WHERE id = ? LIMIT 1',
    [rideId]
  );

  return normalizeRide(rows[0]);
}

export async function updateRideStatusRecord({ rideId, status, actorUserId }) {
  const updatedAt = now();
  const actorId = actorOrSystem(actorUserId);

  if (env.dbClient === 'memory') {
    const ride = memory.rides.find((r) => r.id === rideId);
    if (!ride) return null;
    const before = { ...ride };
    ride.status = status;
    ride.updatedAt = updatedAt;
    await recordRideStatusTransitionAnalytics(before, ride);
    return ride;
  }

  const before = await findRideById(rideId);
  await pool.query('UPDATE rides SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, updatedAt, actorId, rideId]);
  const after = await findRideById(rideId);
  if (after) {
    await createAuditLogRecord({ entityType: 'ride', entityId: rideId, action: 'update', actorUserId: actorId, beforeState: before, afterState: after });
    await recordRideStatusTransitionAnalytics(before, after);
  }
  return after;
}

export async function markRideStartOtpVerified({ rideId, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const verifiedAt = now();

  if (env.dbClient === 'memory') {
    const ride = memory.rides.find((r) => r.id === rideId);
    if (!ride) return null;
    ride.rideStartOtpVerifiedAt = verifiedAt;
    ride.updatedAt = verifiedAt;
    ride.updatedBy = actorId;
    return ride;
  }

  await pool.query('UPDATE rides SET ride_start_otp_verified_at = ?, updated_at = ?, updated_by = ? WHERE id = ?', [
    verifiedAt,
    verifiedAt,
    actorId,
    rideId
  ]);
  return findRideById(rideId);
}

export async function listRidesByUserRole(userId, role) {
  if (env.dbClient === 'memory') {
    if (role === 'rider') return memory.rides.filter((r) => r.riderId === userId);
    if (role === 'driver') return memory.rides.filter((r) => r.driverId === userId);
    return memory.rides;
  }

  let sql =
    'SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, vehicle_type_id, ride_start_otp, ride_start_otp_verified_at, status, created_at, updated_at FROM rides';
  const params = [];

  if (role === 'rider') {
    sql += ' WHERE rider_id = ?';
    params.push(userId);
  } else if (role === 'driver') {
    sql += ' WHERE driver_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(normalizeRide);
}

export async function listActiveRides() {
  if (env.dbClient === 'memory') {
    return memory.rides.filter((r) => !['completed', 'cancelled'].includes(r.status));
  }

  const [rows] = await pool.query(
    "SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, vehicle_type_id, ride_start_otp, ride_start_otp_verified_at, status, created_at, updated_at FROM rides WHERE status NOT IN ('completed', 'cancelled')"
  );

  return rows.map(normalizeRide);
}

export async function createPaymentRecord({
  rideId,
  method,
  provider = 'esewa',
  amount,
  currency = 'NPR',
  providerOrderId = null,
  providerPaymentId = null,
  providerMetadata = null,
  actorUserId
}) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const payment = {
    id: createId(),
    rideId,
    method,
    provider,
    status: 'created',
    amount,
    currency,
    providerOrderId,
    providerPaymentId,
    providerMetadata,
    failureCode: null,
    failureReason: null,
    refundedAmount: 0,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.payments.push(payment);
    return payment;
  }

  await pool.query(
    `INSERT INTO payments (id, ride_id, method, provider, status, amount, currency, provider_order_id, provider_payment_id, provider_metadata, failure_code, failure_reason, refunded_amount, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.id,
      payment.rideId,
      payment.method,
      payment.provider,
      payment.status,
      payment.amount,
      payment.currency,
      payment.providerOrderId,
      payment.providerPaymentId,
      JSON.stringify(payment.providerMetadata || {}),
      payment.failureCode,
      payment.failureReason,
      payment.refundedAmount,
      payment.createdAt,
      payment.updatedAt,
      payment.createdBy,
      payment.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'payment', entityId: payment.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: payment });
  return payment;
}

export async function findPaymentById(paymentId) {
  if (env.dbClient === 'memory') {
    return memory.payments.find((p) => p.id === paymentId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, ride_id AS rideId, method, provider, status, amount, currency, provider_order_id AS providerOrderId,
            provider_payment_id AS providerPaymentId, provider_metadata AS providerMetadata, failure_code AS failureCode,
            failure_reason AS failureReason, refunded_amount AS refundedAmount, created_at AS createdAt, updated_at AS updatedAt
     FROM payments WHERE id = ? LIMIT 1`,
    [paymentId]
  );

  if (!rows[0]) return null;
  return { ...rows[0], providerMetadata: parseJson(rows[0].providerMetadata, {}) };
}

export async function updatePaymentStatus({ paymentId, status, providerPaymentId = null, failureCode = null, failureReason = null, actorUserId }) {
  const updatedAt = now();
  const actorId = actorOrSystem(actorUserId);

  if (env.dbClient === 'memory') {
    const payment = memory.payments.find((p) => p.id === paymentId);
    if (!payment) return null;
    payment.status = status;
    if (providerPaymentId) payment.providerPaymentId = providerPaymentId;
    payment.failureCode = failureCode;
    payment.failureReason = failureReason;
    payment.updatedAt = updatedAt;
    return payment;
  }

  const before = await findPaymentById(paymentId);
  await pool.query(
    'UPDATE payments SET status = ?, provider_payment_id = COALESCE(?, provider_payment_id), failure_code = ?, failure_reason = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    [status, providerPaymentId, failureCode, failureReason, updatedAt, actorId, paymentId]
  );
  const after = await findPaymentById(paymentId);
  if (after) {
    await createAuditLogRecord({ entityType: 'payment', entityId: paymentId, action: 'update', actorUserId: actorId, beforeState: before, afterState: after });
  }
  return after;
}

export async function updatePaymentGatewayDetails({ paymentId, providerOrderId, providerMetadata, actorUserId }) {
  const updatedAt = now();
  const actorId = actorOrSystem(actorUserId);
  if (env.dbClient === 'memory') {
    const payment = memory.payments.find((p) => p.id === paymentId);
    if (!payment) return null;
    payment.providerOrderId = providerOrderId || payment.providerOrderId || null;
    payment.providerMetadata = { ...(payment.providerMetadata || {}), ...(providerMetadata || {}) };
    payment.updatedAt = updatedAt;
    payment.updatedBy = actorId;
    return payment;
  }
  await pool.query(
    'UPDATE payments SET provider_order_id = COALESCE(?, provider_order_id), provider_metadata = ?, updated_at = ?, updated_by = ? WHERE id = ?',
    [providerOrderId || null, JSON.stringify(providerMetadata || {}), updatedAt, actorId, paymentId]
  );
  return findPaymentById(paymentId);
}

export async function createPaymentEventRecord({ paymentId, type, payload, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const event = { id: createId(), paymentId, type, payload, createdAt: ts, updatedAt: ts, createdBy: actorId, updatedBy: actorId };
  if (env.dbClient === 'memory') {
    memory.paymentEvents.push(event);
    return event;
  }
  await pool.query(
    'INSERT INTO payment_events (id, payment_id, type, payload, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [event.id, event.paymentId, event.type, JSON.stringify(event.payload || {}), event.createdAt, event.updatedAt, event.createdBy, event.updatedBy]
  );
  return event;
}

export async function listPaymentEvents(paymentId) {
  if (env.dbClient === 'memory') {
    return memory.paymentEvents.filter((e) => e.paymentId === paymentId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  const [rows] = await pool.query(
    'SELECT id, payment_id AS paymentId, type, payload, created_at AS createdAt FROM payment_events WHERE payment_id = ? ORDER BY created_at ASC',
    [paymentId]
  );
  return rows.map((row) => ({ ...row, payload: parseJson(row.payload, {}) }));
}

export async function createPaymentRefundRecord({ paymentId, amount, reason, status = 'succeeded', providerRefundId = null, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const refund = {
    id: createId(),
    paymentId,
    amount: Number(amount),
    reason: reason || null,
    status,
    providerRefundId: providerRefundId || null,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };
  if (env.dbClient === 'memory') {
    memory.paymentRefunds.push(refund);
    const payment = memory.payments.find((p) => p.id === paymentId);
    if (payment && status === 'succeeded') {
      payment.refundedAmount = Number(payment.refundedAmount || 0) + refund.amount;
      payment.status = payment.refundedAmount >= Number(payment.amount) ? 'refunded' : 'partially_refunded';
      payment.updatedAt = ts;
    }
    return refund;
  }
  await pool.query(
    `INSERT INTO payment_refunds (id, payment_id, amount, reason, status, provider_refund_id, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [refund.id, refund.paymentId, refund.amount, refund.reason, refund.status, refund.providerRefundId, refund.createdAt, refund.updatedAt, refund.createdBy, refund.updatedBy]
  );
  if (status === 'succeeded') {
    await pool.query(
      `UPDATE payments
       SET refunded_amount = refunded_amount + ?, status = CASE WHEN refunded_amount + ? >= amount THEN 'refunded' ELSE 'partially_refunded' END,
           updated_at = ?, updated_by = ?
       WHERE id = ?`,
      [refund.amount, refund.amount, ts, actorId, paymentId]
    );
  }
  return refund;
}

export async function listPaymentRefunds(paymentId) {
  if (env.dbClient === 'memory') {
    return memory.paymentRefunds.filter((r) => r.paymentId === paymentId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
  const [rows] = await pool.query(
    `SELECT id, payment_id AS paymentId, amount, reason, status, provider_refund_id AS providerRefundId, created_at AS createdAt, updated_at AS updatedAt
     FROM payment_refunds WHERE payment_id = ? ORDER BY created_at ASC`,
    [paymentId]
  );
  return rows;
}

export async function createProcessedWebhookRecord({ provider, eventId, eventType, paymentId, payload, status = 'processed', actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const record = {
    id: createId(),
    provider,
    eventId,
    eventType,
    paymentId: paymentId || null,
    payload: payload || {},
    processedAt: ts,
    status,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };
  if (env.dbClient === 'memory') {
    if (memory.paymentWebhooks.some((w) => w.provider === provider && w.eventId === eventId)) return null;
    memory.paymentWebhooks.push(record);
    return record;
  }
  try {
    await pool.query(
      `INSERT INTO payment_webhooks (id, provider, event_id, event_type, payment_id, payload, processed_at, status, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.provider,
        record.eventId,
        record.eventType,
        record.paymentId,
        JSON.stringify(record.payload),
        record.processedAt,
        record.status,
        record.createdAt,
        record.updatedAt,
        record.createdBy,
        record.updatedBy
      ]
    );
    return record;
  } catch {
    return null;
  }
}

export async function createPayoutLedgerRecord({ paymentId, driverId, amount, currency = 'INR', status = 'pending', note = null, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const payout = {
    id: createId(),
    paymentId,
    driverId,
    amount: Number(amount),
    currency,
    status,
    note,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };
  if (env.dbClient === 'memory') {
    memory.payoutLedger.push(payout);
    return payout;
  }
  await pool.query(
    `INSERT INTO payout_ledger (id, payment_id, driver_id, amount, currency, status, note, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [payout.id, payout.paymentId, payout.driverId, payout.amount, payout.currency, payout.status, payout.note, payout.createdAt, payout.updatedAt, payout.createdBy, payout.updatedBy]
  );
  return payout;
}

export async function listPayoutLedger({ driverId = null, status = null } = {}) {
  if (env.dbClient === 'memory') {
    return memory.payoutLedger.filter((p) => (!driverId || p.driverId === driverId) && (!status || p.status === status));
  }
  let sql =
    'SELECT id, payment_id AS paymentId, driver_id AS driverId, amount, currency, status, note, created_at AS createdAt, updated_at AS updatedAt FROM payout_ledger WHERE 1=1';
  const params = [];
  if (driverId) {
    sql += ' AND driver_id = ?';
    params.push(driverId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getPaymentsReconciliationSummary() {
  if (env.dbClient === 'memory') {
    const payments = memory.payments;
    const payouts = memory.payoutLedger;
    const toNumLocal = (v) => Number(v || 0);
    const byStatus = {};
    for (const p of payments) {
      byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    }
    return {
      totalPayments: payments.length,
      totalCapturedAmount: payments.filter((p) => ['succeeded', 'partially_refunded', 'refunded'].includes(p.status)).reduce((a, p) => a + toNumLocal(p.amount), 0),
      totalRefundedAmount: payments.reduce((a, p) => a + toNumLocal(p.refundedAmount), 0),
      totalPendingPayoutAmount: payouts.filter((p) => p.status === 'pending').reduce((a, p) => a + toNumLocal(p.amount), 0),
      paymentStatusCounts: byStatus
    };
  }

  const [paymentStatsRows] = await pool.query(
    `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS totalAmount, COALESCE(SUM(refunded_amount), 0) AS totalRefunded
     FROM payments
     GROUP BY status`
  );
  const [payoutRows] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS pendingPayoutAmount FROM payout_ledger WHERE status = 'pending'"
  );
  const counts = {};
  let captured = 0;
  let refunded = 0;
  for (const row of paymentStatsRows) {
    counts[row.status] = Number(row.count);
    if (['succeeded', 'partially_refunded', 'refunded'].includes(row.status)) captured += Number(row.totalAmount || 0);
    refunded += Number(row.totalRefunded || 0);
  }
  const [totalRows] = await pool.query('SELECT COUNT(*) AS count FROM payments');
  return {
    totalPayments: Number(totalRows[0].count),
    totalCapturedAmount: captured,
    totalRefundedAmount: refunded,
    totalPendingPayoutAmount: Number(payoutRows[0].pendingPayoutAmount || 0),
    paymentStatusCounts: counts
  };
}

export async function listPaymentMethods({ activeOnly = true, app = null, country = null, currency = null } = {}) {
  if (env.dbClient === 'memory') {
    return memory.paymentMethods
      .filter(
        (m) =>
          (!activeOnly || m.isActive) &&
          (!app || (m.appScopes || []).includes(app)) &&
          (!country || m.countries.includes(country)) &&
          (!currency || m.currencies.includes(currency))
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }
  let sql =
    'SELECT id, provider, method_code AS methodCode, display_name AS displayName, category, app_scopes AS appScopes, countries, currencies, is_active AS isActive, sort_order AS sortOrder FROM payment_methods WHERE 1=1';
  const params = [];
  if (activeOnly) sql += ' AND is_active = true';
  sql += ' ORDER BY sort_order ASC, display_name ASC';
  const [rows] = await pool.query(sql, params);
  return rows
    .map((row) => ({
      ...row,
      appScopes: parseJson(row.appScopes, []),
      countries: parseJson(row.countries, []),
      currencies: parseJson(row.currencies, [])
    }))
    .filter((row) => (!app || row.appScopes.includes(app)) && (!country || row.countries.includes(country)) && (!currency || row.currencies.includes(currency)));
}

export async function upsertPaymentMethodRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const record = {
    id: data.id || createId(),
    provider: String(data.provider).toLowerCase(),
    methodCode: String(data.methodCode),
    displayName: data.displayName,
    category: data.category || 'wallet',
    appScopes: Array.isArray(data.appScopes) ? data.appScopes : ['rider'],
    countries: Array.isArray(data.countries) ? data.countries : ['np'],
    currencies: Array.isArray(data.currencies) ? data.currencies : ['NPR'],
    isActive: data.isActive ?? true,
    sortOrder: Number(data.sortOrder ?? 100),
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };
  if (env.dbClient === 'memory') {
    const existing = memory.paymentMethods.find((m) => m.provider === record.provider && m.methodCode === record.methodCode);
    if (existing) {
      Object.assign(existing, record, { createdAt: existing.createdAt, createdBy: existing.createdBy });
      return existing;
    }
    memory.paymentMethods.push(record);
    return record;
  }

  await pool.query(
    `INSERT INTO payment_methods (id, provider, method_code, display_name, category, app_scopes, countries, currencies, is_active, sort_order, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       category = VALUES(category),
       app_scopes = VALUES(app_scopes),
       countries = VALUES(countries),
       currencies = VALUES(currencies),
       is_active = VALUES(is_active),
       sort_order = VALUES(sort_order),
       updated_at = VALUES(updated_at),
       updated_by = VALUES(updated_by)`,
    [
      record.id,
      record.provider,
      record.methodCode,
      record.displayName,
      record.category,
      JSON.stringify(record.appScopes),
      JSON.stringify(record.countries),
      JSON.stringify(record.currencies),
      record.isActive,
      record.sortOrder,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy
    ]
  );
  const [rows] = await pool.query(
    `SELECT id, provider, method_code AS methodCode, display_name AS displayName, category, app_scopes AS appScopes, countries, currencies, is_active AS isActive, sort_order AS sortOrder
     FROM payment_methods WHERE provider = ? AND method_code = ? LIMIT 1`,
    [record.provider, record.methodCode]
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    appScopes: parseJson(rows[0].appScopes, []),
    countries: parseJson(rows[0].countries, []),
    currencies: parseJson(rows[0].currencies, [])
  };
}

export async function createRatingRecord({ rideId, fromUserId, toUserId, score, comment, actorUserId }) {
  const actorId = actorOrSystem(actorUserId || fromUserId);
  const ts = now();
  const rating = {
    id: createId(),
    rideId,
    fromUserId,
    toUserId,
    score,
    comment: comment || '',
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    const existing = memory.ratings.find((r) => r.rideId === rideId && r.fromUserId === fromUserId && r.toUserId === toUserId);
    if (existing) {
      throw new Error('Rating already submitted for this direction');
    }
    memory.ratings.push(rating);
    await upsertUserRatingStats(toUserId, score, ts);
    return rating;
  }

  await pool.query(
    'INSERT INTO ratings (id, ride_id, from_user_id, to_user_id, score, comment, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [rating.id, rating.rideId, rating.fromUserId, rating.toUserId, rating.score, rating.comment, rating.createdAt, rating.updatedAt, rating.createdBy, rating.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'rating', entityId: rating.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: rating });
  await upsertUserRatingStats(toUserId, score, ts);
  return rating;
}

async function upsertUserRatingStats(userId, score, ratedAt) {
  if (env.dbClient === 'memory') {
    const existing = memory.userRatingStats.find((s) => s.userId === userId);
    if (!existing) {
      memory.userRatingStats.push({
        userId,
        totalReceivedRatings: 1,
        totalReceivedScore: Number(score),
        averageReceivedRating: Number(score),
        lastRatedAt: ratedAt,
        updatedAt: ratedAt
      });
      return;
    }
    existing.totalReceivedRatings += 1;
    existing.totalReceivedScore += Number(score);
    existing.averageReceivedRating = Number((existing.totalReceivedScore / existing.totalReceivedRatings).toFixed(2));
    existing.lastRatedAt = ratedAt;
    existing.updatedAt = ratedAt;
    return;
  }

  await pool.query(
    `INSERT INTO user_rating_stats (user_id, total_received_ratings, total_received_score, average_received_rating, last_rated_at, updated_at)
     VALUES (?, 1, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       total_received_ratings = total_received_ratings + 1,
       total_received_score = total_received_score + VALUES(total_received_score),
       average_received_rating = ROUND((total_received_score + VALUES(total_received_score)) / (total_received_ratings + 1), 2),
       last_rated_at = VALUES(last_rated_at),
       updated_at = VALUES(updated_at)`,
    [userId, Number(score), Number(score), ratedAt, ratedAt]
  );
}

export async function findDirectionalRating({ rideId, fromUserId, toUserId }) {
  if (env.dbClient === 'memory') {
    return memory.ratings.find((r) => r.rideId === rideId && r.fromUserId === fromUserId && r.toUserId === toUserId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, ride_id AS rideId, from_user_id AS fromUserId, to_user_id AS toUserId, score, comment, created_at AS createdAt
     FROM ratings
     WHERE ride_id = ? AND from_user_id = ? AND to_user_id = ?
     LIMIT 1`,
    [rideId, fromUserId, toUserId]
  );
  return rows[0] || null;
}

export async function listRatingsForUser(userId) {
  if (env.dbClient === 'memory') {
    return memory.ratings.filter((r) => r.toUserId === userId);
  }

  const [rows] = await pool.query(
    `SELECT id, ride_id AS rideId, from_user_id AS fromUserId, to_user_id AS toUserId, score, comment, created_at AS createdAt
     FROM ratings
     WHERE to_user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function getUserRatingStats(userId) {
  if (env.dbClient === 'memory') {
    return (
      memory.userRatingStats.find((s) => s.userId === userId) || {
        userId,
        totalReceivedRatings: 0,
        totalReceivedScore: 0,
        averageReceivedRating: 0,
        lastRatedAt: null
      }
    );
  }

  const [rows] = await pool.query(
    `SELECT user_id AS userId, total_received_ratings AS totalReceivedRatings, total_received_score AS totalReceivedScore,
            average_received_rating AS averageReceivedRating, last_rated_at AS lastRatedAt
     FROM user_rating_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return (
    rows[0] || {
      userId,
      totalReceivedRatings: 0,
      totalReceivedScore: 0,
      averageReceivedRating: 0,
      lastRatedAt: null
    }
  );
}

export async function countRides() {
  if (env.dbClient === 'memory') return memory.rides.length;
  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM rides');
  return Number(rows[0].count);
}

export async function createCouponRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const coupon = {
    id: createId(),
    code: data.code.toUpperCase(),
    discountType: data.discountType,
    discountValue: Number(data.discountValue),
    maxDiscount: data.maxDiscount == null ? null : Number(data.maxDiscount),
    minFare: Number(data.minFare ?? 0),
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    usageLimit: Number(data.usageLimit ?? 0),
    usedCount: 0,
    isActive: data.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.coupons.push(coupon);
    return coupon;
  }

  await pool.query(
    `INSERT INTO coupons (id, code, discount_type, discount_value, max_discount, min_fare, starts_at, ends_at, usage_limit, used_count, is_active, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      coupon.id,
      coupon.code,
      coupon.discountType,
      coupon.discountValue,
      coupon.maxDiscount,
      coupon.minFare,
      coupon.startsAt,
      coupon.endsAt,
      coupon.usageLimit,
      coupon.usedCount,
      coupon.isActive,
      coupon.createdAt,
      coupon.updatedAt,
      coupon.createdBy,
      coupon.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'coupon', entityId: coupon.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: coupon });
  return coupon;
}

export async function listCoupons() {
  if (env.dbClient === 'memory') return memory.coupons;
  const [rows] = await pool.query(
    `SELECT id, code, discount_type AS discountType, discount_value AS discountValue, max_discount AS maxDiscount, min_fare AS minFare, starts_at AS startsAt, ends_at AS endsAt,
            usage_limit AS usageLimit, used_count AS usedCount, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM coupons ORDER BY created_at DESC`
  );
  return rows;
}

export async function findCouponByCode(code) {
  const normalizedCode = code.toUpperCase();
  if (env.dbClient === 'memory') {
    return memory.coupons.find((c) => c.code === normalizedCode) || null;
  }
  const [rows] = await pool.query(
    `SELECT id, code, discount_type AS discountType, discount_value AS discountValue, max_discount AS maxDiscount, min_fare AS minFare, starts_at AS startsAt, ends_at AS endsAt,
            usage_limit AS usageLimit, used_count AS usedCount, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM coupons WHERE code = ? LIMIT 1`,
    [normalizedCode]
  );
  return rows[0] || null;
}

export async function incrementCouponUsage(couponId, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  if (env.dbClient === 'memory') {
    const coupon = memory.coupons.find((c) => c.id === couponId);
    if (!coupon) return null;
    coupon.usedCount += 1;
    coupon.updatedAt = now();
    coupon.updatedBy = actorId;
    return coupon;
  }
  await pool.query('UPDATE coupons SET used_count = used_count + 1, updated_at = ?, updated_by = ? WHERE id = ?', [now(), actorId, couponId]);
  const [rows] = await pool.query(
    `SELECT id, code, discount_type AS discountType, discount_value AS discountValue, max_discount AS maxDiscount, min_fare AS minFare, starts_at AS startsAt, ends_at AS endsAt,
            usage_limit AS usageLimit, used_count AS usedCount, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM coupons WHERE id = ? LIMIT 1`,
    [couponId]
  );
  return rows[0] || null;
}

export async function createCouponRedemptionRecord({ couponId, couponCode, rideId, riderId, discountAmount, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const redemption = {
    id: createId(),
    couponId,
    couponCode,
    rideId,
    riderId,
    discountAmount,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.couponRedemptions.push(redemption);
    await recordCouponRedemptionAnalytics(redemption);
    return redemption;
  }

  await pool.query(
    `INSERT INTO coupon_redemptions (id, coupon_id, coupon_code, ride_id, rider_id, discount_amount, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      redemption.id,
      redemption.couponId,
      redemption.couponCode,
      redemption.rideId,
      redemption.riderId,
      redemption.discountAmount,
      redemption.createdAt,
      redemption.updatedAt,
      redemption.createdBy,
      redemption.updatedBy
    ]
  );
  await recordCouponRedemptionAnalytics(redemption);
  return redemption;
}

export async function createOfferRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const offer = {
    id: createId(),
    title: data.title,
    description: data.description || '',
    cityId: data.cityId || null,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    isActive: data.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.offers.push(offer);
    return offer;
  }

  await pool.query(
    `INSERT INTO offers (id, title, description, city_id, starts_at, ends_at, is_active, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [offer.id, offer.title, offer.description, offer.cityId, offer.startsAt, offer.endsAt, offer.isActive, offer.createdAt, offer.updatedAt, offer.createdBy, offer.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'offer', entityId: offer.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: offer });
  return offer;
}

export async function listActiveOffers(cityId) {
  const current = new Date().toISOString();
  if (env.dbClient === 'memory') {
    return memory.offers.filter((o) => o.isActive && o.startsAt <= current && o.endsAt >= current && (!o.cityId || !cityId || o.cityId === cityId));
  }

  const [rows] = await pool.query(
    `SELECT id, title, description, city_id AS cityId, starts_at AS startsAt, ends_at AS endsAt, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM offers
     WHERE is_active = true AND starts_at <= ? AND ends_at >= ? AND (? IS NULL OR city_id IS NULL OR city_id = ?)
     ORDER BY created_at DESC`,
    [current, current, cityId || null, cityId || null]
  );
  return rows;
}

export async function createPenaltyRecord({ userId, rideId, amount, reason, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const penalty = {
    id: createId(),
    userId,
    rideId: rideId || null,
    amount: Number(amount),
    reason,
    status: 'applied',
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.penalties.push(penalty);
    await recordPenaltyAnalytics(penalty);
    return penalty;
  }

  await pool.query(
    `INSERT INTO penalties (id, user_id, ride_id, amount, reason, status, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [penalty.id, penalty.userId, penalty.rideId, penalty.amount, penalty.reason, penalty.status, penalty.createdAt, penalty.updatedAt, penalty.createdBy, penalty.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'penalty', entityId: penalty.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: penalty });
  await recordPenaltyAnalytics(penalty);
  return penalty;
}

export async function listPenaltiesByUser(userId) {
  if (env.dbClient === 'memory') {
    return memory.penalties.filter((p) => p.userId === userId && p.status === 'applied');
  }

  const [rows] = await pool.query(
    'SELECT id, user_id AS userId, ride_id AS rideId, amount, reason, status, created_at AS createdAt FROM penalties WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
    [userId, 'applied']
  );
  return rows;
}

export async function listAllPenalties() {
  if (env.dbClient === 'memory') {
    return memory.penalties.filter((p) => p.status === 'applied');
  }

  const [rows] = await pool.query(
    'SELECT id, user_id AS userId, ride_id AS rideId, amount, reason, status, created_at AS createdAt FROM penalties WHERE status = ? ORDER BY created_at DESC',
    ['applied']
  );
  return rows;
}

export async function listCouponRedemptionsByRider(riderId) {
  if (env.dbClient === 'memory') {
    return memory.couponRedemptions.filter((r) => r.riderId === riderId);
  }

  const [rows] = await pool.query(
    'SELECT id, coupon_id AS couponId, coupon_code AS couponCode, ride_id AS rideId, rider_id AS riderId, discount_amount AS discountAmount, created_at AS createdAt FROM coupon_redemptions WHERE rider_id = ? ORDER BY created_at DESC',
    [riderId]
  );
  return rows;
}

export async function listDriverDailyStats(driverId) {
  if (env.dbClient === 'memory') {
    return memory.driverDailyStats.filter((r) => r.driverId === driverId);
  }

  const [rows] = await pool.query(
    `SELECT stat_date AS statDate, driver_id AS driverId, total_rides AS totalRides, completed_rides AS completedRides, cancelled_rides AS cancelledRides,
            gross_earnings AS grossEarnings, commission_given AS commissionGiven, penalties_amount AS penaltiesAmount, net_earnings AS netEarnings
     FROM driver_daily_stats
     WHERE driver_id = ?`,
    [driverId]
  );
  return rows;
}

export async function listRiderDailyStats(riderId) {
  if (env.dbClient === 'memory') {
    return memory.riderDailyStats.filter((r) => r.riderId === riderId);
  }

  const [rows] = await pool.query(
    `SELECT stat_date AS statDate, rider_id AS riderId, total_rides AS totalRides, completed_rides AS completedRides, cancelled_rides AS cancelledRides,
            total_spent AS totalSpent, total_savings AS totalSavings, penalties_amount AS penaltiesAmount
     FROM rider_daily_stats
     WHERE rider_id = ?`,
    [riderId]
  );
  return rows;
}

export async function listAdminDailyStats() {
  if (env.dbClient === 'memory') {
    return memory.adminDailyStats;
  }

  const [rows] = await pool.query(
    `SELECT stat_date AS statDate, total_rides AS totalRides, completed_rides AS completedRides, cancelled_rides AS cancelledRides,
            gross_bookings AS grossBookings, commission_earned AS commissionEarned, penalties_collected AS penaltiesCollected,
            net_platform_revenue AS netPlatformRevenue
     FROM admin_daily_stats`
  );
  return rows;
}

export async function findDirectConversation({ participantAId, participantBId, rideId = null }) {
  const [a, b] = [participantAId, participantBId].sort();
  if (env.dbClient === 'memory') {
    return (
      memory.conversations.find((c) => c.participantAId === a && c.participantBId === b && (c.rideId || null) === (rideId || null)) || null
    );
  }

  const [rows] = await pool.query(
    `SELECT id, participant_a_id AS participantAId, participant_b_id AS participantBId, ride_id AS rideId, created_at AS createdAt, updated_at AS updatedAt
     FROM conversations
     WHERE participant_a_id = ? AND participant_b_id = ? AND ((ride_id IS NULL AND ? IS NULL) OR ride_id = ?)
     LIMIT 1`,
    [a, b, rideId, rideId]
  );
  return rows[0] || null;
}

export async function createConversationRecord({ participantAId, participantBId, rideId = null, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const [a, b] = [participantAId, participantBId].sort();
  const ts = now();
  const conversation = {
    id: createId(),
    participantAId: a,
    participantBId: b,
    rideId: rideId || null,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.conversations.push(conversation);
    return conversation;
  }

  await pool.query(
    `INSERT INTO conversations (id, participant_a_id, participant_b_id, ride_id, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      conversation.id,
      conversation.participantAId,
      conversation.participantBId,
      conversation.rideId,
      conversation.createdAt,
      conversation.updatedAt,
      conversation.createdBy,
      conversation.updatedBy
    ]
  );
  await createAuditLogRecord({
    entityType: 'conversation',
    entityId: conversation.id,
    action: 'create',
    actorUserId: actorId,
    beforeState: null,
    afterState: conversation
  });
  return conversation;
}

export async function listConversationsForUser(userId) {
  if (env.dbClient === 'memory') {
    return memory.conversations
      .filter((c) => c.participantAId === userId || c.participantBId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  const [rows] = await pool.query(
    `SELECT id, participant_a_id AS participantAId, participant_b_id AS participantBId, ride_id AS rideId, created_at AS createdAt, updated_at AS updatedAt
     FROM conversations
     WHERE participant_a_id = ? OR participant_b_id = ?
     ORDER BY updated_at DESC`,
    [userId, userId]
  );
  return rows;
}

export async function findConversationById(conversationId) {
  if (env.dbClient === 'memory') {
    return memory.conversations.find((c) => c.id === conversationId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, participant_a_id AS participantAId, participant_b_id AS participantBId, ride_id AS rideId, created_at AS createdAt, updated_at AS updatedAt
     FROM conversations
     WHERE id = ?
     LIMIT 1`,
    [conversationId]
  );
  return rows[0] || null;
}

export async function createMessageRecord({ conversationId, senderUserId, content, actorUserId }) {
  const actorId = actorOrSystem(actorUserId || senderUserId);
  const ts = now();
  const message = {
    id: createId(),
    conversationId,
    senderUserId,
    content,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.messages.push(message);
    const conv = memory.conversations.find((c) => c.id === conversationId);
    if (conv) conv.updatedAt = ts;
    return message;
  }

  await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_user_id, content, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [message.id, message.conversationId, message.senderUserId, message.content, message.createdAt, message.updatedAt, message.createdBy, message.updatedBy]
  );
  await pool.query('UPDATE conversations SET updated_at = ?, updated_by = ? WHERE id = ?', [ts, actorId, conversationId]);
  await createAuditLogRecord({
    entityType: 'message',
    entityId: message.id,
    action: 'create',
    actorUserId: actorId,
    beforeState: null,
    afterState: message
  });
  return message;
}

export async function listMessagesByConversation(conversationId) {
  if (env.dbClient === 'memory') {
    return memory.messages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  const [rows] = await pool.query(
    `SELECT id, conversation_id AS conversationId, sender_user_id AS senderUserId, content, created_at AS createdAt
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at ASC`,
    [conversationId]
  );
  return rows;
}

export async function listVehicleTypes({ onlyActive = true } = {}) {
  if (env.dbClient === 'memory') {
    return onlyActive ? memory.vehicleTypes.filter((v) => v.isActive) : memory.vehicleTypes;
  }

  const [rows] = await pool.query(
    `SELECT id, code, name, capacity, fare_multiplier AS fareMultiplier, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM vehicle_types
     ${onlyActive ? 'WHERE is_active = true' : ''}
     ORDER BY capacity ASC, code ASC`
  );
  return rows;
}

export async function findVehicleTypeById(id) {
  const normalized = String(id || '');
  if (env.dbClient === 'memory') {
    return memory.vehicleTypes.find((v) => v.id === normalized) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, code, name, capacity, fare_multiplier AS fareMultiplier, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
     FROM vehicle_types
     WHERE id = ?
     LIMIT 1`,
    [normalized]
  );
  return rows[0] || null;
}

export async function createVehicleTypeRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const vt = {
    id: data.id || createId(),
    code: String(data.code).toLowerCase(),
    name: data.name,
    capacity: Number(data.capacity),
    fareMultiplier: Number(data.fareMultiplier),
    isActive: data.isActive ?? true,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.vehicleTypes.push(vt);
    return vt;
  }

  await pool.query(
    `INSERT INTO vehicle_types (id, code, name, capacity, fare_multiplier, is_active, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [vt.id, vt.code, vt.name, vt.capacity, vt.fareMultiplier, vt.isActive, vt.createdAt, vt.updatedAt, vt.createdBy, vt.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'vehicle_type', entityId: vt.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: vt });
  return vt;
}

export async function createDriverVehicleRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const record = {
    id: data.id || createId(),
    driverId: data.driverId,
    vehicleTypeId: data.vehicleTypeId,
    plateNumber: data.plateNumber,
    modelName: data.modelName || null,
    color: data.color || null,
    isActive: data.isActive ?? true,
    isDefault: data.isDefault ?? false,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    if (record.isDefault) {
      memory.driverVehicles.forEach((v) => {
        if (v.driverId === record.driverId) v.isDefault = false;
      });
    }
    memory.driverVehicles.push(record);
    return record;
  }

  if (record.isDefault) {
    await pool.query('UPDATE driver_vehicles SET is_default = false, updated_at = ?, updated_by = ? WHERE driver_id = ?', [
      ts,
      actorId,
      record.driverId
    ]);
  }

  await pool.query(
    `INSERT INTO driver_vehicles (id, driver_id, vehicle_type_id, plate_number, model_name, color, is_active, is_default, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.driverId,
      record.vehicleTypeId,
      record.plateNumber,
      record.modelName,
      record.color,
      record.isActive,
      record.isDefault,
      record.createdAt,
      record.updatedAt,
      record.createdBy,
      record.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'driver_vehicle', entityId: record.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: record });
  return record;
}

export async function listDriverVehicles(driverId) {
  if (env.dbClient === 'memory') {
    return memory.driverVehicles.filter((v) => v.driverId === driverId);
  }

  const [rows] = await pool.query(
    `SELECT id, driver_id AS driverId, vehicle_type_id AS vehicleTypeId, plate_number AS plateNumber, model_name AS modelName, color, is_active AS isActive, is_default AS isDefault,
            created_at AS createdAt, updated_at AS updatedAt
     FROM driver_vehicles
     WHERE driver_id = ?
     ORDER BY is_default DESC, created_at DESC`,
    [driverId]
  );
  return rows;
}

export async function upsertDriverKycRecord(data, actorUserId) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();

  const payload = {
    id: data.id || createId(),
    driverId: data.driverId,
    fullName: data.fullName,
    licenseNumber: data.licenseNumber,
    documentUrl: data.documentUrl || null,
    status: data.status || 'submitted',
    rejectionReason: data.rejectionReason || null,
    reviewedBy: data.reviewedBy || null,
    reviewedAt: data.reviewedAt || null,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    const existing = memory.driverKycRecords.find((r) => r.driverId === data.driverId);
    if (existing) {
      existing.fullName = payload.fullName;
      existing.licenseNumber = payload.licenseNumber;
      existing.documentUrl = payload.documentUrl;
      existing.status = payload.status;
      existing.rejectionReason = payload.rejectionReason;
      existing.reviewedBy = payload.reviewedBy;
      existing.reviewedAt = payload.reviewedAt;
      existing.updatedAt = payload.updatedAt;
      existing.updatedBy = payload.updatedBy;
      return existing;
    }
    memory.driverKycRecords.push(payload);
    return payload;
  }

  await pool.query(
    `INSERT INTO driver_kyc_records (id, driver_id, full_name, license_number, document_url, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       license_number = VALUES(license_number),
       document_url = VALUES(document_url),
       status = VALUES(status),
       rejection_reason = VALUES(rejection_reason),
       reviewed_by = VALUES(reviewed_by),
       reviewed_at = VALUES(reviewed_at),
       updated_at = VALUES(updated_at),
       updated_by = VALUES(updated_by)`,
    [
      payload.id,
      payload.driverId,
      payload.fullName,
      payload.licenseNumber,
      payload.documentUrl,
      payload.status,
      payload.rejectionReason,
      payload.reviewedBy,
      payload.reviewedAt,
      payload.createdAt,
      payload.updatedAt,
      payload.createdBy,
      payload.updatedBy
    ]
  );
  return getDriverKycRecord(payload.driverId);
}

export async function getDriverKycRecord(driverId) {
  if (env.dbClient === 'memory') {
    return memory.driverKycRecords.find((r) => r.driverId === driverId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, driver_id AS driverId, full_name AS fullName, license_number AS licenseNumber, document_url AS documentUrl, status,
            rejection_reason AS rejectionReason, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt
     FROM driver_kyc_records
     WHERE driver_id = ?
     LIMIT 1`,
    [driverId]
  );
  return rows[0] || null;
}

export async function listDriverKycRecords(status = null) {
  if (env.dbClient === 'memory') {
    return status ? memory.driverKycRecords.filter((r) => r.status === status) : memory.driverKycRecords;
  }

  const [rows] = status
    ? await pool.query(
        `SELECT id, driver_id AS driverId, full_name AS fullName, license_number AS licenseNumber, document_url AS documentUrl, status,
                rejection_reason AS rejectionReason, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt
         FROM driver_kyc_records
         WHERE status = ?
         ORDER BY updated_at DESC`,
        [status]
      )
    : await pool.query(
        `SELECT id, driver_id AS driverId, full_name AS fullName, license_number AS licenseNumber, document_url AS documentUrl, status,
                rejection_reason AS rejectionReason, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt, updated_at AS updatedAt
         FROM driver_kyc_records
         ORDER BY updated_at DESC`
      );
  return rows;
}

export async function createParcelRecord({
  senderUserId,
  driverId,
  cityId,
  pickup,
  drop,
  senderName,
  senderPhone,
  receiverName,
  receiverPhone,
  receiverEmail,
  receiverAddress,
  itemDescription,
  weightKg,
  fare,
  vehicleTypeId,
  handoffOtp,
  status,
  actorUserId
}) {
  const actorId = actorOrSystem(actorUserId || senderUserId);
  const ts = now();
  const parcel = {
    id: createId(),
    senderUserId,
    driverId: driverId || null,
    cityId,
    pickup,
    drop,
    senderName: senderName || null,
    senderPhone: senderPhone || null,
    receiverName,
    receiverPhone,
    receiverEmail: receiverEmail || null,
    receiverAddress: receiverAddress || null,
    itemDescription,
    weightKg: Number(weightKg),
    fare: Number(fare),
    vehicleTypeId: vehicleTypeId || null,
    handoffOtp,
    pickupOtpVerifiedAt: null,
    dropOtpVerifiedAt: null,
    status,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.parcels.push(parcel);
    return parcel;
  }

  await pool.query(
    `INSERT INTO parcels (id, sender_user_id, driver_id, city_id, pickup, drop_location, sender_name, sender_phone, receiver_name, receiver_phone, receiver_email, receiver_address, item_description, weight_kg, fare, vehicle_type_id, handoff_otp, pickup_otp_verified_at, drop_otp_verified_at, status, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parcel.id,
      parcel.senderUserId,
      parcel.driverId,
      parcel.cityId,
      JSON.stringify(parcel.pickup),
      JSON.stringify(parcel.drop),
      parcel.senderName,
      parcel.senderPhone,
      parcel.receiverName,
      parcel.receiverPhone,
      parcel.receiverEmail,
      parcel.receiverAddress,
      parcel.itemDescription,
      parcel.weightKg,
      parcel.fare,
      parcel.vehicleTypeId,
      parcel.handoffOtp,
      parcel.pickupOtpVerifiedAt,
      parcel.dropOtpVerifiedAt,
      parcel.status,
      parcel.createdAt,
      parcel.updatedAt,
      parcel.createdBy,
      parcel.updatedBy
    ]
  );

  return parcel;
}

export async function insertParcelEvent({ parcelId, type, payload, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const event = {
    id: createId(),
    parcelId,
    type,
    payload,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.parcelEvents.push(event);
    return event;
  }

  await pool.query(
    `INSERT INTO parcel_events (id, parcel_id, type, payload, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.id, event.parcelId, event.type, JSON.stringify(event.payload), event.createdAt, event.updatedAt, event.createdBy, event.updatedBy]
  );
  return event;
}

export async function findParcelById(parcelId) {
  if (env.dbClient === 'memory') {
    return memory.parcels.find((p) => p.id === parcelId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, sender_user_id, driver_id, city_id, pickup, drop_location, sender_name, sender_phone, receiver_name, receiver_phone, receiver_email, receiver_address, item_description, weight_kg, fare, vehicle_type_id, handoff_otp, pickup_otp_verified_at, drop_otp_verified_at, status, created_at, updated_at
     FROM parcels
     WHERE id = ?
     LIMIT 1`,
    [parcelId]
  );

  return normalizeParcel(rows[0]);
}

export async function updateParcelStatusRecord({ parcelId, status, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const updatedAt = now();

  if (env.dbClient === 'memory') {
    const parcel = memory.parcels.find((p) => p.id === parcelId);
    if (!parcel) return null;
    parcel.status = status;
    parcel.updatedAt = updatedAt;
    parcel.updatedBy = actorId;
    return parcel;
  }

  await pool.query('UPDATE parcels SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, updatedAt, actorId, parcelId]);
  return findParcelById(parcelId);
}

export async function markParcelOtpVerified({ parcelId, otpType, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const verifiedAt = now();

  const field = otpType === 'pickup' ? 'pickupOtpVerifiedAt' : 'dropOtpVerifiedAt';

  if (env.dbClient === 'memory') {
    const parcel = memory.parcels.find((p) => p.id === parcelId);
    if (!parcel) return null;
    parcel[field] = verifiedAt;
    parcel.updatedAt = verifiedAt;
    parcel.updatedBy = actorId;
    return parcel;
  }

  const column = otpType === 'pickup' ? 'pickup_otp_verified_at' : 'drop_otp_verified_at';
  await pool.query(`UPDATE parcels SET ${column} = ?, updated_at = ?, updated_by = ? WHERE id = ?`, [verifiedAt, verifiedAt, actorId, parcelId]);
  return findParcelById(parcelId);
}

export async function listParcelsByUserRole(userId, role) {
  if (env.dbClient === 'memory') {
    if (role === 'rider') return memory.parcels.filter((p) => p.senderUserId === userId);
    if (role === 'driver') return memory.parcels.filter((p) => p.driverId === userId);
    return memory.parcels;
  }

  let sql =
    'SELECT id, sender_user_id, driver_id, city_id, pickup, drop_location, sender_name, sender_phone, receiver_name, receiver_phone, receiver_email, receiver_address, item_description, weight_kg, fare, vehicle_type_id, handoff_otp, pickup_otp_verified_at, drop_otp_verified_at, status, created_at, updated_at FROM parcels';
  const params = [];

  if (role === 'rider') {
    sql += ' WHERE sender_user_id = ?';
    params.push(userId);
  } else if (role === 'driver') {
    sql += ' WHERE driver_id = ?';
    params.push(userId);
  }

  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(normalizeParcel);
}

function normalizeNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    recipientUserId: row.recipientUserId || row.recipient_user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    payload: parseJson(row.payload, null),
    channel: row.channel,
    status: row.status,
    sentAt: row.sentAt || row.sent_at || null,
    receivedAt: row.receivedAt || row.received_at || null,
    deliveredAt: row.deliveredAt || row.delivered_at || null,
    readAt: row.readAt || row.read_at || null,
    createdAt: row.createdAt || row.created_at,
    updatedAt: row.updatedAt || row.updated_at
  };
}

export async function createNotificationRecord({ recipientUserId, type, title, body, payload = null, channel = 'in_app', actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const notification = {
    id: createId(),
    recipientUserId,
    type,
    title,
    body,
    payload,
    channel,
    status: 'sent',
    sentAt: ts,
    receivedAt: null,
    deliveredAt: null,
    readAt: null,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.notifications.push(notification);
    return notification;
  }

  await pool.query(
    `INSERT INTO notifications
      (id, recipient_user_id, type, title, body, payload, channel, status, sent_at, received_at, delivered_at, read_at, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.id,
      notification.recipientUserId,
      notification.type,
      notification.title,
      notification.body,
      JSON.stringify(notification.payload || {}),
      notification.channel,
      notification.status,
      notification.sentAt,
      notification.receivedAt,
      notification.deliveredAt,
      notification.readAt,
      notification.createdAt,
      notification.updatedAt,
      notification.createdBy,
      notification.updatedBy
    ]
  );
  await createAuditLogRecord({
    entityType: 'notification',
    entityId: notification.id,
    action: 'create',
    actorUserId: actorId,
    beforeState: null,
    afterState: notification
  });
  return notification;
}

export async function findNotificationById(notificationId) {
  if (env.dbClient === 'memory') {
    return memory.notifications.find((n) => n.id === notificationId) || null;
  }

  const [rows] = await pool.query(
    `SELECT id, recipient_user_id AS recipientUserId, type, title, body, payload, channel, status, sent_at AS sentAt,
            received_at AS receivedAt, delivered_at AS deliveredAt, read_at AS readAt, created_at AS createdAt, updated_at AS updatedAt
     FROM notifications WHERE id = ? LIMIT 1`,
    [notificationId]
  );
  return normalizeNotification(rows[0]);
}

export async function listNotificationsByUser(userId, limit = 100) {
  if (env.dbClient === 'memory') {
    return memory.notifications.filter((n) => n.recipientUserId === userId).slice(-limit).reverse();
  }

  const [rows] = await pool.query(
    `SELECT id, recipient_user_id AS recipientUserId, type, title, body, payload, channel, status, sent_at AS sentAt,
            received_at AS receivedAt, delivered_at AS deliveredAt, read_at AS readAt, created_at AS createdAt, updated_at AS updatedAt
     FROM notifications
     WHERE recipient_user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, limit]
  );
  return rows.map(normalizeNotification);
}

export async function markNotificationStatus({ notificationId, recipientUserId, status, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const allowed = new Set(['received', 'delivered', 'read']);
  if (!allowed.has(status)) {
    throw new Error('Unsupported notification status');
  }

  const existing = await findNotificationById(notificationId);
  if (!existing) return null;
  if (existing.recipientUserId !== recipientUserId) return null;

  if (env.dbClient === 'memory') {
    const notif = memory.notifications.find((n) => n.id === notificationId && n.recipientUserId === recipientUserId);
    if (!notif) return null;
    notif.status = status;
    if (status === 'received' && !notif.receivedAt) notif.receivedAt = ts;
    if (status === 'delivered' && !notif.deliveredAt) notif.deliveredAt = ts;
    if (status === 'read' && !notif.readAt) notif.readAt = ts;
    notif.updatedAt = ts;
    notif.updatedBy = actorId;
    return notif;
  }

  await pool.query(
    `UPDATE notifications
     SET status = ?,
         received_at = CASE WHEN ? = 'received' AND received_at IS NULL THEN ? ELSE received_at END,
         delivered_at = CASE WHEN ? = 'delivered' AND delivered_at IS NULL THEN ? ELSE delivered_at END,
         read_at = CASE WHEN ? = 'read' AND read_at IS NULL THEN ? ELSE read_at END,
         updated_at = ?,
         updated_by = ?
     WHERE id = ? AND recipient_user_id = ?`,
    [status, status, ts, status, ts, status, ts, ts, actorId, notificationId, recipientUserId]
  );
  const updated = await findNotificationById(notificationId);
  if (updated) {
    await createAuditLogRecord({
      entityType: 'notification',
      entityId: notificationId,
      action: 'update',
      actorUserId: actorId,
      beforeState: existing,
      afterState: updated
    });
  }
  return updated;
}

export async function getNotificationStats({ recipientUserId = null } = {}) {
  if (env.dbClient === 'memory') {
    const rows = recipientUserId ? memory.notifications.filter((n) => n.recipientUserId === recipientUserId) : memory.notifications;
    return {
      total: rows.length,
      sent: rows.filter((n) => n.status === 'sent').length,
      received: rows.filter((n) => Boolean(n.receivedAt)).length,
      delivered: rows.filter((n) => Boolean(n.deliveredAt)).length,
      read: rows.filter((n) => Boolean(n.readAt)).length
    };
  }

  const where = recipientUserId ? 'WHERE recipient_user_id = ?' : '';
  const params = recipientUserId ? [recipientUserId] : [];
  const [rows] = await pool.query(
    `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN received_at IS NOT NULL THEN 1 ELSE 0 END) AS received,
        SUM(CASE WHEN delivered_at IS NOT NULL THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN read_at IS NOT NULL THEN 1 ELSE 0 END) AS read
     FROM notifications ${where}`,
    params
  );
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    sent: Number(row.sent || 0),
    received: Number(row.received || 0),
    delivered: Number(row.delivered || 0),
    read: Number(row.read || 0)
  };
}

export async function upsertUserDeviceToken({ userId, app, platform, token, actorUserId }) {
  const actorId = actorOrSystem(actorUserId || userId);
  const ts = now();
  const record = {
    id: createId(),
    userId,
    app,
    platform,
    token,
    isActive: true,
    lastSeenAt: ts,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    const existing = memory.userDeviceTokens.find((t) => t.userId === userId && t.token === token);
    if (existing) {
      existing.app = app;
      existing.platform = platform;
      existing.isActive = true;
      existing.lastSeenAt = ts;
      existing.updatedAt = ts;
      existing.updatedBy = actorId;
      return existing;
    }
    memory.userDeviceTokens.push(record);
    return record;
  }

  const [existingRows] = await pool.query(
    'SELECT id FROM user_device_tokens WHERE user_id = ? AND token = ? LIMIT 1',
    [userId, token]
  );
  if (existingRows.length) {
    await pool.query(
      `UPDATE user_device_tokens
       SET app = ?, platform = ?, is_active = true, last_seen_at = ?, updated_at = ?, updated_by = ?
       WHERE user_id = ? AND token = ?`,
      [app, platform, ts, ts, actorId, userId, token]
    );
    const [rows] = await pool.query(
      `SELECT id, user_id AS userId, app, platform, token, is_active AS isActive, last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
       FROM user_device_tokens WHERE user_id = ? AND token = ? LIMIT 1`,
      [userId, token]
    );
    return rows[0];
  }

  await pool.query(
    `INSERT INTO user_device_tokens (id, user_id, app, platform, token, is_active, last_seen_at, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.userId, record.app, record.platform, record.token, record.isActive, record.lastSeenAt, record.createdAt, record.updatedAt, record.createdBy, record.updatedBy]
  );
  return record;
}

export async function listActiveDeviceTokensByUser(userId) {
  if (env.dbClient === 'memory') {
    return memory.userDeviceTokens.filter((t) => t.userId === userId && t.isActive);
  }

  const [rows] = await pool.query(
    `SELECT id, user_id AS userId, app, platform, token, is_active AS isActive, last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
     FROM user_device_tokens
     WHERE user_id = ? AND is_active = true
     ORDER BY updated_at DESC`,
    [userId]
  );
  return rows;
}

export async function deactivateDeviceToken({ userId, token, actorUserId }) {
  const actorId = actorOrSystem(actorUserId || userId);
  const ts = now();
  if (env.dbClient === 'memory') {
    const existing = memory.userDeviceTokens.find((t) => t.userId === userId && t.token === token);
    if (!existing) return null;
    existing.isActive = false;
    existing.updatedAt = ts;
    existing.updatedBy = actorId;
    return existing;
  }

  await pool.query(
    'UPDATE user_device_tokens SET is_active = false, updated_at = ?, updated_by = ? WHERE user_id = ? AND token = ?',
    [ts, actorId, userId, token]
  );
  const [rows] = await pool.query(
    `SELECT id, user_id AS userId, app, platform, token, is_active AS isActive, last_seen_at AS lastSeenAt, created_at AS createdAt, updated_at AS updatedAt
     FROM user_device_tokens WHERE user_id = ? AND token = ? LIMIT 1`,
    [userId, token]
  );
  return rows[0] || null;
}

export async function createReportRecord({ rideId, reporterUserId, reportedUserId, reason, description, actorUserId }) {
  const actorId = actorOrSystem(actorUserId || reporterUserId);
  const ts = now();
  const report = {
    id: createId(),
    rideId: rideId || null,
    reporterUserId,
    reportedUserId,
    reason,
    description: description || '',
    status: 'open',
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.reports.push(report);
    return report;
  }

  await pool.query(
    'INSERT INTO reports (id, ride_id, reporter_user_id, reported_user_id, reason, description, status, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      report.id,
      report.rideId,
      report.reporterUserId,
      report.reportedUserId,
      report.reason,
      report.description,
      report.status,
      report.createdAt,
      report.updatedAt,
      report.createdBy,
      report.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'report', entityId: report.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: report });
  return report;
}

export async function countOpenReportsAgainstUser(userId) {
  if (env.dbClient === 'memory') {
    return memory.reports.filter((r) => r.reportedUserId === userId && r.status === 'open').length;
  }

  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM reports WHERE reported_user_id = ? AND status = 'open'",
    [userId]
  );
  return Number(rows[0].count);
}

export async function listReportsByReporter(userId) {
  if (env.dbClient === 'memory') {
    return memory.reports.filter((r) => r.reporterUserId === userId);
  }

  const [rows] = await pool.query(
    'SELECT id, ride_id AS rideId, reporter_user_id AS reporterUserId, reported_user_id AS reportedUserId, reason, description, status, created_at AS createdAt FROM reports WHERE reporter_user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function listAllReports() {
  if (env.dbClient === 'memory') {
    return [...memory.reports];
  }

  const [rows] = await pool.query(
    'SELECT id, ride_id AS rideId, reporter_user_id AS reporterUserId, reported_user_id AS reportedUserId, reason, description, status, created_at AS createdAt FROM reports ORDER BY created_at DESC'
  );
  return rows;
}

export async function listAuditLogs(limit = 200) {
  if (env.dbClient === 'memory') {
    return memory.auditLogs.slice(-limit).reverse();
  }

  const [rows] = await pool.query(
    'SELECT id, entity_type AS entityType, entity_id AS entityId, action, actor_user_id AS actorUserId, before_state AS beforeState, after_state AS afterState, created_at AS createdAt FROM audit_logs ORDER BY created_at DESC LIMIT ?',
    [limit]
  );
  return rows.map((row) => ({
    ...row,
    beforeState: parseJson(row.beforeState, null),
    afterState: parseJson(row.afterState, null)
  }));
}

export async function createAccountActionRecord({ userId, action, source, metadata, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const accountAction = {
    id: createId(),
    userId,
    action,
    source,
    metadata,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.accountActions.push(accountAction);
    return accountAction;
  }

  await pool.query(
    'INSERT INTO account_actions (id, user_id, action, source, metadata, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [accountAction.id, accountAction.userId, accountAction.action, accountAction.source, JSON.stringify(accountAction.metadata), accountAction.createdAt, accountAction.updatedAt, accountAction.createdBy, accountAction.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'account_action', entityId: accountAction.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: accountAction });
  return accountAction;
}

export async function createAuditLogRecord({ entityType, entityId, action, actorUserId, beforeState, afterState }) {
  const audit = {
    id: createId(),
    entityType,
    entityId,
    action,
    actorUserId: actorOrSystem(actorUserId),
    beforeState: beforeState || null,
    afterState: afterState || null,
    createdAt: now()
  };

  if (env.dbClient === 'memory') {
    memory.auditLogs.push(audit);
    return audit;
  }

  await pool.query(
    'INSERT INTO audit_logs (id, entity_type, entity_id, action, actor_user_id, before_state, after_state, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [audit.id, audit.entityType, audit.entityId, audit.action, audit.actorUserId, JSON.stringify(audit.beforeState), JSON.stringify(audit.afterState), audit.createdAt]
  );
  return audit;
}

export async function resetMemoryStore() {
  if (env.dbClient === 'mysql' && pool) {
    const tables = [
      'messages',
      'notifications',
      'user_device_tokens',
      'conversations',
      'coupon_redemptions',
      'offers',
      'coupons',
      'penalties',
      'account_actions',
      'reports',
      'ratings',
      'user_rating_stats',
      'payment_refunds',
      'payment_events',
      'payment_webhooks',
      'payout_ledger',
      'payments',
      'ride_events',
      'rides',
      'parcel_events',
      'parcels',
      'driver_locations',
      'driver_vehicles',
      'driver_kyc_records',
      'driver_daily_stats',
      'rider_daily_stats',
      'admin_daily_stats',
      'users',
      'payment_methods',
      'vehicle_types',
      'cities'
    ];
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE ${table}`);
    }
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    await migrateMySql();
    return;
  }

  memory.users = [];
  memory.rides = [];
  memory.parcels = [];
  memory.parcelEvents = [];
  memory.rideEvents = [];
  memory.driverLocations = [];
  memory.driverVehicles = [];
  memory.driverKycRecords = [];
  memory.ratings = [];
  memory.userRatingStats = [];
  memory.payments = [];
  memory.paymentEvents = [];
  memory.paymentRefunds = [];
  memory.paymentWebhooks = [];
  memory.payoutLedger = [];
  memory.paymentMethods = paymentMethodConfigs.map((m) => ({ ...m }));
  memory.coupons = [];
  memory.offers = [];
  memory.couponRedemptions = [];
  memory.penalties = [];
  memory.conversations = [];
  memory.messages = [];
  memory.notifications = [];
  memory.userDeviceTokens = [];
  memory.vehicleTypes = vehicleTypeConfigs.map((v) => ({ ...v }));
  memory.reports = [];
  memory.accountActions = [];
  memory.auditLogs = [];
  memory.cities = [...cityConfigs];
}
