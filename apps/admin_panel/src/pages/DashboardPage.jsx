import { useEffect } from 'react'
import { useLazyAdminAnalyticsQuery, useLazyLiveRidesQuery, useLazyReportsQuery } from '../services/api'
import DataTable from '../components/DataTable'
import StatCard from '../components/StatCard'
import { FiActivity, FiBell, FiDollarSign, FiUsers } from 'react-icons/fi'

function DashboardPage() {
  const [loadAnalytics, analyticsState] = useLazyAdminAnalyticsQuery()
  const [loadRides, ridesState] = useLazyLiveRidesQuery()
  const [loadReports, reportsState] = useLazyReportsQuery()

  useEffect(() => {
    void Promise.all([loadAnalytics(), loadRides(), loadReports()])
  }, [loadAnalytics, loadReports, loadRides])

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Rides" value={analyticsState.data?.totalRides ?? '-'} icon={FiActivity} />
        <StatCard title="Total Users" value={analyticsState.data?.counters?.usersTotal ?? '-'} icon={FiUsers} />
        <StatCard title="Notifications Sent" value={analyticsState.data?.counters?.notificationsSent ?? '-'} icon={FiBell} />
        <StatCard title="Commission" value={analyticsState.data?.totalCommission ?? '-'} icon={FiDollarSign} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <DataTable title="Live Rides" rows={ridesState.data || []} searchableKeys={['id', 'status', 'riderId', 'driverId', 'cityId']} />
        <DataTable title="Reports" rows={reportsState.data || []} searchableKeys={['id', 'status', 'reason', 'reportedUserId', 'reporterUserId']} />
      </div>
    </section>
  )
}

export default DashboardPage
