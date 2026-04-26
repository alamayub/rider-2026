import { useEffect } from 'react'
import { useLazyAdminAnalyticsQuery, useLazyLiveRidesQuery, useLazyReportsQuery } from '../services/api'
import DataTable from '../components/DataTable'
import StatCard from '../components/StatCard'
import { FiActivity, FiAlertCircle, FiBell, FiDollarSign, FiPackage, FiRadio, FiTrendingUp, FiUsers } from 'react-icons/fi'

function DashboardPage() {
  const [loadAnalytics, analyticsState] = useLazyAdminAnalyticsQuery()
  const [loadRides, ridesState] = useLazyLiveRidesQuery()
  const [loadReports, reportsState] = useLazyReportsQuery()

  useEffect(() => {
    void Promise.all([loadAnalytics(), loadRides(), loadReports()])
  }, [loadAnalytics, loadReports, loadRides])

  const cr = analyticsState.data?.cityRevenue || []
  const combined = analyticsState.data?.platformRevenue?.periods
  const liveRides = ridesState.data || []
  const openReports = reportsState.data || []
  const showRevenueTable =
    combined != null || (Array.isArray(cr) && cr.length > 0)
  const formatMoney = (n, ccy) => (n == null || n === '' ? '—' : `${ccy || '₹'} ${Number(n).toFixed(0)}`)

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rides" value={analyticsState.data?.totalRides ?? '-'} icon={FiActivity} />
        <StatCard title="Total Users" value={analyticsState.data?.counters?.usersTotal ?? '-'} icon={FiUsers} />
        <StatCard title="Notifications Sent" value={analyticsState.data?.counters?.notificationsSent ?? '-'} icon={FiBell} />
        <StatCard title="Commission (all time)" value={analyticsState.data?.totalCommission ?? '-'} icon={FiDollarSign} />
        <StatCard
          title="Parcels delivered (all time)"
          value={analyticsState.data?.totalParcelsDelivered ?? '-'}
          icon={FiPackage}
        />
        <StatCard title="Total revenue (gross)" value={analyticsState.data?.totalRevenue ?? '-'} icon={FiTrendingUp} />
        <StatCard title="Live Rides" value={String(liveRides.length)} icon={FiRadio} />
        <StatCard title="Open Reports" value={String(openReports.length)} icon={FiAlertCircle} />
      </div>
      {showRevenueTable ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Revenue by city</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Day / week / month / year / all time are summed from stored daily rollups. Amounts are net platform revenue
            (commission and penalties, as on the server).
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-3">City</th>
                  <th className="py-2 pr-3 text-right">Today (net)</th>
                  <th className="py-2 pr-3 text-right">This week</th>
                  <th className="py-2 pr-3 text-right">This month</th>
                  <th className="py-2 pr-3 text-right">This year</th>
                  <th className="py-2 text-right">All time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {combined ? (
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-900">
                    <td className="py-2 pr-3 font-semibold">All cities (combined)</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(combined.daily?.netPlatformRevenue, ' ')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(combined.weekly?.netPlatformRevenue, ' ')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(combined.monthly?.netPlatformRevenue, ' ')}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(combined.yearly?.netPlatformRevenue, ' ')}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{formatMoney(combined.all?.netPlatformRevenue, ' ')}</td>
                  </tr>
                ) : null}
                {cr.map((row) => {
                  const p = row.periods || {}
                  const ccy = row.currency || 'INR'
                  return (
                    <tr key={String(row.cityId)} className="text-slate-800">
                      <td className="py-2 pr-3 font-medium">{row.cityName || row.cityCode}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatMoney(p.daily?.netPlatformRevenue, ccy)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatMoney(p.weekly?.netPlatformRevenue, ccy)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatMoney(p.monthly?.netPlatformRevenue, ccy)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-600">{formatMoney(p.yearly?.netPlatformRevenue, ccy)}</td>
                      <td className="py-2 text-right tabular-nums font-medium text-slate-900">{formatMoney(p.all?.netPlatformRevenue, ccy)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable title="Live Rides" rows={ridesState.data || []} searchableKeys={['id', 'status', 'riderId', 'driverId', 'cityId']} />
        <DataTable title="Reports" rows={reportsState.data || []} searchableKeys={['id', 'status', 'reason', 'reportedUserId', 'reporterUserId']} />
      </div>
    </section>
  )
}

export default DashboardPage
