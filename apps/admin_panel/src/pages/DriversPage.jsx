import { useMemo, useState } from 'react'
import { useAdminUsersQuery, useUpdateUserStatusMutation, useUserAccountActionsQuery, useDriverKycQuery } from '../services/api'
import DataTable from '../components/DataTable'
import { FiTruck, FiShield } from 'react-icons/fi'

function DriversPage() {
  const [status, setStatus] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [reason, setReason] = useState('')
  const { data: users = [], refetch } = useAdminUsersQuery({ role: 'driver', status, limit: 200 })
  const { data: actions = [] } = useUserAccountActionsQuery({ userId: selectedUserId, limit: 100 }, { skip: !selectedUserId })
  const { data: kyc = [] } = useDriverKycQuery('')
  const [updateStatus, updateState] = useUpdateUserStatusMutation()

  const selected = useMemo(() => users.find((u) => String(u.id) === String(selectedUserId)), [users, selectedUserId])

  const runAction = async (nextStatus) => {
    if (!selectedUserId) return
    await updateStatus({ userId: selectedUserId, status: nextStatus, reason }).unwrap()
    await refetch()
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <FiTruck />
            Driver Actions
          </h3>
          <div className="space-y-2">
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="banned">banned</option>
            </select>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
              <option value="">Select driver</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id} - {u.phone} ({u.status})
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason for action"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => runAction('active')} disabled={updateState.isLoading || !selectedUserId}>
                Activate
              </button>
              <button className="rounded-lg border px-3 py-2 text-sm" onClick={() => runAction('suspended')} disabled={updateState.isLoading || !selectedUserId}>
                Suspend
              </button>
              <button className="rounded-lg border px-3 py-2 text-sm text-red-700" onClick={() => runAction('banned')} disabled={updateState.isLoading || !selectedUserId}>
                Ban
              </button>
            </div>
            {selected && <p className="text-xs text-slate-500">Selected: {selected.phone} ({selected.status})</p>}
            {updateState.error && <p className="text-xs text-red-600">{updateState.error?.data?.error || updateState.error?.error || 'Failed action'}</p>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <FiShield />
            Driver KYC + Action History
          </h3>
          <p className="mb-2 text-xs text-slate-600">KYC submissions: {Array.isArray(kyc) ? kyc.length : 0}</p>
          <pre className="max-h-80 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(actions, null, 2)}</pre>
        </div>
      </div>
      <DataTable title="All Drivers" rows={users} searchableKeys={['id', 'phone', 'email', 'status', 'role']} />
    </section>
  )
}

export default DriversPage
