import { useMyNotificationsQuery, useMyNotificationStatsQuery } from '../services/api'
import DataTable from '../components/DataTable'
import { FiBell } from 'react-icons/fi'

function NotificationsPage() {
  const { data: stats } = useMyNotificationStatsQuery()
  const { data: notifications } = useMyNotificationsQuery()
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
          <FiBell size={16} />
          My Notification Stats
        </h3>
        <pre className="max-h-96 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(stats || {}, null, 2)}</pre>
      </div>
      <DataTable title="My Notifications" rows={notifications || []} searchableKeys={['id', 'type', 'title', 'status', 'recipientUserId']} />
    </section>
  )
}

export default NotificationsPage
