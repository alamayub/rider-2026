import { useMemo, useState } from 'react'
import { useAdminUsersQuery, useUpdateUserStatusMutation, useUserAccountActionsQuery } from '../services/api'
import DataTable from '../components/DataTable'
import { ModerationReasonDialog, RowModerationMenu } from '../components/AccountModeration'
import { FiAlertCircle, FiUserCheck, FiUserMinus, FiUsers, FiUserX } from 'react-icons/fi'

function formatWhen(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

function StatTile({ label, value, sub, icon: Icon, accent }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br p-4 shadow-sm ${accent || 'from-white to-slate-50'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? <Icon className="shrink-0 text-slate-400" size={18} aria-hidden /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  )
}

function UsersPage() {
  const [status, setStatus] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [listSearch, setListSearch] = useState('')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [moderationDialog, setModerationDialog] = useState(null)
  const [dialogReason, setDialogReason] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)

  const {
    data: users = [],
    refetch,
    isError,
  } = useAdminUsersQuery({ role: 'rider', status, limit: 200 })
  const { data: actions = [], isFetching: actionsLoading } = useUserAccountActionsQuery(
    { userId: selectedUserId, limit: 100 },
    { skip: !selectedUserId },
  )
  const [updateStatus, updateState] = useUpdateUserStatusMutation()

  const stats = useMemo(() => {
    const total = users.length
    const active = users.filter((u) => u.status === 'active').length
    const suspended = users.filter((u) => u.status === 'suspended').length
    const banned = users.filter((u) => u.status === 'banned').length
    return { total, active, suspended, banned }
  }, [users])

  const openModeration = (user, mode) => {
    setDialogReason('')
    setDialogError('')
    setModerationDialog({ user: { id: user.id, phone: user.phone, status: user.status }, mode })
  }

  const closeModeration = () => {
    setModerationDialog(null)
    setDialogReason('')
    setDialogError('')
  }

  const confirmModeration = async () => {
    if (!moderationDialog) return
    const { user, mode } = moderationDialog
    const needsReason = mode !== 'active'
    if (needsReason && !dialogReason.trim()) {
      setDialogError('Please enter a reason for this action.')
      return
    }
    setDialogError('')
    setUpdatingId(String(user.id))
    try {
      await updateStatus({
        userId: String(user.id),
        status: mode,
        reason: dialogReason.trim() || undefined,
      }).unwrap()
      await refetch()
      closeModeration()
      setMenuOpenId(null)
    } catch (e) {
      setDialogError(e?.data?.error || e?.error || 'Action failed')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="space-y-8">
      {isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <FiAlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden />
          <span>Could not load riders. Check your session and try again.</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Listed riders" value={stats.total} sub="Current filter from API" icon={FiUsers} accent="from-sky-50/80 to-white" />
        <StatTile label="Active" value={stats.active} sub="Can request rides" icon={FiUserCheck} accent="from-emerald-50/80 to-white" />
        <StatTile label="Suspended" value={stats.suspended} sub="Temporarily blocked" icon={FiUserMinus} accent="from-amber-50/80 to-white" />
        <StatTile label="Banned" value={stats.banned} sub="Permanently blocked" icon={FiUserX} accent="from-red-50/70 to-white" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-slate-800">Account actions</h3>
          <p className="mt-1 text-xs text-slate-500">
            {selectedUserId ? `History for user #${selectedUserId}` : 'Use “Account history” on a row to load audit entries.'}
            {actionsLoading ? <span className="ml-2 text-slate-400">loading…</span> : null}
          </p>
        </div>
        <div className="overflow-x-auto">
          {!selectedUserId ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">No user selected.</p>
          ) : !actions.length ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">No account actions recorded yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">When</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actions.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:px-5">{formatWhen(row.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{row.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{row.source || '—'}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 font-mono text-[11px] text-slate-600" title={JSON.stringify(row.metadata ?? {})}>
                      {JSON.stringify(row.metadata ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Directory</h3>
            <p className="text-xs text-slate-500">
              Status filter applies to the list request; use Actions on a row to moderate. Search narrows the table without
              another API call.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:w-auto">
            <label className="flex min-w-[10rem] flex-col gap-1 text-xs font-medium text-slate-600 sm:min-w-[11rem]">
              Account status filter
              <select
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 sm:min-w-[14rem]">
              Search directory
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm sm:w-72"
                placeholder="id, phone, email, status…"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
              />
            </label>
          </div>
        </div>
        <DataTable
          title="Riders"
          rows={users}
          searchableKeys={['id', 'phone', 'email', 'status', 'role']}
          pageSize={10}
          hideSearch
          externalQuery={listSearch}
          getRowKey={(row) => String(row.id)}
          renderActions={(row) => (
            <RowModerationMenu
              row={row}
              menuOpenId={menuOpenId}
              setMenuOpenId={setMenuOpenId}
              onViewHistory={(r) => setSelectedUserId(String(r.id))}
              onChooseStatus={(r, mode) => openModeration(r, mode)}
              rowBusy={updatingId === String(row.id)}
            />
          )}
        />
      </div>

      <ModerationReasonDialog
        open={Boolean(moderationDialog)}
        mode={moderationDialog?.mode}
        user={moderationDialog?.user}
        reason={dialogReason}
        setReason={setDialogReason}
        loading={updateState.isLoading}
        error={dialogError}
        onClose={closeModeration}
        onConfirm={confirmModeration}
      />
    </section>
  )
}

export default UsersPage
