import { randomUUID } from 'crypto';
import mysql from 'mysql2/promise';
import cityConfigs from '../config/cities.json' with { type: 'json' };
import { env } from '../config/env.js';

const now = () => new Date().toISOString();
const createId = () => randomUUID();

let pool = null;

const memory = {
  users: [],
  rides: [],
  rideEvents: [],
  driverLocations: [],
  ratings: [],
  payments: [],
  coupons: [],
  offers: [],
  couponRedemptions: [],
  reports: [],
  accountActions: [],
  auditLogs: [],
  cities: [...cityConfigs]
};

function actorOrSystem(actorUserId) {
  return actorUserId || 'system';
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
  await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE rides ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

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
      status VARCHAR(24) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NULL,
      created_by VARCHAR(36) NOT NULL,
      updated_by VARCHAR(36) NOT NULL
    )
  `);
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

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
      updated_by VARCHAR(36) NOT NULL
    )
  `);
  await pool.query('ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_at DATETIME NOT NULL');
  await pool.query("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS created_by VARCHAR(36) NOT NULL DEFAULT 'system'");
  await pool.query("ALTER TABLE ratings ADD COLUMN IF NOT EXISTS updated_by VARCHAR(36) NOT NULL DEFAULT 'system'");

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
  if (env.dbClient === 'memory') {
    return;
  }

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
    'SELECT id, phone, email, role, status, created_at AS createdAt FROM users WHERE phone = ? AND role = ? LIMIT 1',
    [phone, role]
  );
  return rows[0] || null;
}

export async function createUser({ phone, email, role }) {
  const ts = now();
  const user = { id: createId(), phone, email: email || null, role, status: 'active', createdAt: ts, updatedAt: ts, createdBy: 'system', updatedBy: 'system' };

  if (env.dbClient === 'memory') {
    memory.users.push(user);
    return user;
  }

  await pool.query('INSERT INTO users (id, phone, email, role, status, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    user.id,
    user.phone,
    user.email,
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
    'SELECT id, phone, email, role, status, created_at AS createdAt FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
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

export async function listOnlineDriverLocationsByCity(cityId) {
  if (env.dbClient === 'memory') {
    return memory.driverLocations.filter((loc) => loc.cityId === cityId && loc.online);
  }

  const [rows] = await pool.query(
    'SELECT driver_id AS driverId, city_id AS cityId, lat, lng, online, updated_at AS updatedAt FROM driver_locations WHERE city_id = ? AND online = true',
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

export async function createRideRecord({ riderId, driverId, cityId, pickup, drop, fare, status, actorUserId }) {
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
    status,
    createdAt: ts,
    updatedAt: ts,
    createdBy: actorId,
    updatedBy: actorId
  };

  if (env.dbClient === 'memory') {
    memory.rides.push(ride);
    return ride;
  }

  await pool.query(
    `INSERT INTO rides (id, rider_id, driver_id, city_id, pickup, drop_location, fare, status, created_at, updated_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ride.id,
      ride.riderId,
      ride.driverId,
      ride.cityId,
      JSON.stringify(ride.pickup),
      JSON.stringify(ride.drop),
      ride.fare,
      ride.status,
      ride.createdAt,
      ride.updatedAt,
      ride.createdBy,
      ride.updatedBy
    ]
  );
  await createAuditLogRecord({ entityType: 'ride', entityId: ride.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: ride });
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
    'SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, status, created_at, updated_at FROM rides WHERE id = ? LIMIT 1',
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
    ride.status = status;
    ride.updatedAt = updatedAt;
    return ride;
  }

  const before = await findRideById(rideId);
  await pool.query('UPDATE rides SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, updatedAt, actorId, rideId]);
  const after = await findRideById(rideId);
  if (after) {
    await createAuditLogRecord({ entityType: 'ride', entityId: rideId, action: 'update', actorUserId: actorId, beforeState: before, afterState: after });
  }
  return after;
}

export async function listRidesByUserRole(userId, role) {
  if (env.dbClient === 'memory') {
    if (role === 'rider') return memory.rides.filter((r) => r.riderId === userId);
    if (role === 'driver') return memory.rides.filter((r) => r.driverId === userId);
    return memory.rides;
  }

  let sql = 'SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, status, created_at, updated_at FROM rides';
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
    "SELECT id, rider_id, driver_id, city_id, pickup, drop_location, fare, status, created_at, updated_at FROM rides WHERE status NOT IN ('completed', 'cancelled')"
  );

  return rows.map(normalizeRide);
}

export async function createPaymentRecord({ rideId, method, amount, actorUserId }) {
  const actorId = actorOrSystem(actorUserId);
  const ts = now();
  const payment = {
    id: createId(),
    rideId,
    method,
    status: 'created',
    amount,
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
    'INSERT INTO payments (id, ride_id, method, status, amount, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [payment.id, payment.rideId, payment.method, payment.status, payment.amount, payment.createdAt, payment.updatedAt, payment.createdBy, payment.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'payment', entityId: payment.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: payment });
  return payment;
}

export async function findPaymentById(paymentId) {
  if (env.dbClient === 'memory') {
    return memory.payments.find((p) => p.id === paymentId) || null;
  }

  const [rows] = await pool.query(
    'SELECT id, ride_id AS rideId, method, status, amount, created_at AS createdAt, updated_at AS updatedAt FROM payments WHERE id = ? LIMIT 1',
    [paymentId]
  );

  return rows[0] || null;
}

export async function updatePaymentStatus({ paymentId, status, actorUserId }) {
  const updatedAt = now();
  const actorId = actorOrSystem(actorUserId);

  if (env.dbClient === 'memory') {
    const payment = memory.payments.find((p) => p.id === paymentId);
    if (!payment) return null;
    payment.status = status;
    payment.updatedAt = updatedAt;
    return payment;
  }

  const before = await findPaymentById(paymentId);
  await pool.query('UPDATE payments SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?', [status, updatedAt, actorId, paymentId]);
  const after = await findPaymentById(paymentId);
  if (after) {
    await createAuditLogRecord({ entityType: 'payment', entityId: paymentId, action: 'update', actorUserId: actorId, beforeState: before, afterState: after });
  }
  return after;
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
    memory.ratings.push(rating);
    return rating;
  }

  await pool.query(
    'INSERT INTO ratings (id, ride_id, from_user_id, to_user_id, score, comment, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [rating.id, rating.rideId, rating.fromUserId, rating.toUserId, rating.score, rating.comment, rating.createdAt, rating.updatedAt, rating.createdBy, rating.updatedBy]
  );
  await createAuditLogRecord({ entityType: 'rating', entityId: rating.id, action: 'create', actorUserId: actorId, beforeState: null, afterState: rating });
  return rating;
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

export function resetMemoryStore() {
  memory.users = [];
  memory.rides = [];
  memory.rideEvents = [];
  memory.driverLocations = [];
  memory.ratings = [];
  memory.payments = [];
  memory.coupons = [];
  memory.offers = [];
  memory.couponRedemptions = [];
  memory.reports = [];
  memory.accountActions = [];
  memory.auditLogs = [];
  memory.cities = [...cityConfigs];
}
