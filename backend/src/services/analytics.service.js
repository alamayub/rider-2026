import { env } from '../config/env.js';
import {
  getPlatformCounters,
  listAdminCityDailyStats,
  listAdminDailyStats,
  listCities,
  listDriverDailyStats,
  listRiderDailyStats
} from '../db/store.js';

function getPeriodStart(period) {
  const now = new Date();
  if (period === 'all') return new Date(0);
  if (period === 'daily') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'weekly') {
    const day = now.getDay();
    const diff = (day + 6) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  }
  if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'yearly') return new Date(now.getFullYear(), 0, 1);
  return new Date(0);
}

function filterByPeriod(items, dateKey, period) {
  const start = getPeriodStart(period).getTime();
  return items.filter((i) => new Date(i[dateKey]).getTime() >= start);
}

function sum(values) {
  return values.reduce((acc, v) => acc + Number(v || 0), 0);
}

function buildDriverPeriodStats(rows) {
  return {
    totalRides: sum(rows.map((r) => r.totalRides)),
    completedRides: sum(rows.map((r) => r.completedRides)),
    cancelledRides: sum(rows.map((r) => r.cancelledRides)),
    grossEarnings: sum(rows.map((r) => r.grossEarnings)),
    commissionGiven: sum(rows.map((r) => r.commissionGiven)),
    penaltiesAmount: sum(rows.map((r) => r.penaltiesAmount)),
    netEarnings: sum(rows.map((r) => r.netEarnings))
  };
}

function buildRiderPeriodStats(rows) {
  return {
    totalRides: sum(rows.map((r) => r.totalRides)),
    completedRides: sum(rows.map((r) => r.completedRides)),
    cancelledRides: sum(rows.map((r) => r.cancelledRides)),
    totalSpent: sum(rows.map((r) => r.totalSpent)),
    totalSavings: sum(rows.map((r) => r.totalSavings)),
    penaltiesAmount: sum(rows.map((r) => r.penaltiesAmount))
  };
}

function buildAdminPeriodStats(rows) {
  return {
    totalRides: sum(rows.map((r) => r.totalRides)),
    completedRides: sum(rows.map((r) => r.completedRides)),
    cancelledRides: sum(rows.map((r) => r.cancelledRides)),
    parcelsDelivered: sum(rows.map((r) => Number(r?.parcelsDelivered || 0))),
    grossBookings: sum(rows.map((r) => r.grossBookings)),
    commissionEarned: sum(rows.map((r) => r.commissionEarned)),
    penaltiesCollected: sum(rows.map((r) => r.penaltiesCollected)),
    netPlatformRevenue: sum(rows.map((r) => r.netPlatformRevenue))
  };
}

function periodized(periodBuilder) {
  const periods = ['daily', 'weekly', 'monthly', 'yearly', 'all'];
  const out = {};
  for (const period of periods) {
    out[period] = periodBuilder(period);
  }
  return out;
}

export async function getDriverAnalytics(driverId) {
  const rows = await listDriverDailyStats(driverId);

  return {
    commissionRatePercent: env.commissionRatePercent,
    periods: periodized((period) =>
      buildDriverPeriodStats(filterByPeriod(rows, 'statDate', period))
    )
  };
}

export async function getRiderAnalytics(riderId) {
  const rows = await listRiderDailyStats(riderId);

  return {
    periods: periodized((period) =>
      buildRiderPeriodStats(filterByPeriod(rows, 'statDate', period))
    )
  };
}

export async function getAdminAnalytics() {
  const rows = await listAdminDailyStats();
  const cityDayRows = await listAdminCityDailyStats();
  const cities = await listCities();
  const counters = await getPlatformCounters();
  const all = buildAdminPeriodStats(filterByPeriod(rows, 'statDate', 'all'));

  const byCity = cities.map((c) => {
    const cRows = cityDayRows.filter((r) => String(r.cityId) === String(c.id));
    return {
      cityId: c.id,
      cityCode: c.code,
      cityName: c.name,
      currency: c.currency,
      periods: periodized((period) => buildAdminPeriodStats(filterByPeriod(cRows, 'statDate', period)))
    };
  });

  return {
    commissionRatePercent: env.commissionRatePercent,
    counters,
    totalRides: all.totalRides,
    totalParcelsDelivered: all.parcelsDelivered,
    totalRevenue: all.grossBookings,
    totalCommission: all.commissionEarned,
    platformRevenue: {
      label: 'All cities (combined)',
      periods: periodized((period) => buildAdminPeriodStats(filterByPeriod(rows, 'statDate', period)))
    },
    cityRevenue: byCity,
    /** @deprecated use platformRevenue.periods — kept for admin_panel compatibility */
    periods: periodized((period) => buildAdminPeriodStats(filterByPeriod(rows, 'statDate', period)))
  };
}
