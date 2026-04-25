import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  useAdminGlobalNotificationStatsQuery,
  useAdminSearchUsersQuery,
  useAdminSendNotificationMutation,
  useMarkNotificationDeliveredMutation,
  useMarkNotificationReadMutation,
  useMarkNotificationReceivedMutation,
  useMyNotificationsQuery,
  useMyNotificationStatsQuery,
} from '../services/api'
import {
  FiBell,
  FiChevronDown,
  FiChevronRight,
  FiInbox,
  FiLayers,
  FiMail,
  FiSend,
  FiSmartphone,
  FiCheck,
  FiEye,
  FiPackage,
  FiX,
} from 'react-icons/fi'

function StatTile({ label, value, icon: Icon, accent }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-gradient-to-br p-4 shadow-sm ${accent || 'from-white to-slate-50'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {Icon ? <Icon className="text-slate-400" size={18} /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

function statusBadge(status) {
  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium'
  const map = {
    sent: `${base} bg-sky-100 text-sky-800`,
    received: `${base} bg-amber-100 text-amber-900`,
    delivered: `${base} bg-violet-100 text-violet-800`,
    read: `${base} bg-emerald-100 text-emerald-800`,
  }
  return <span className={map[status] || `${base} bg-slate-100 text-slate-700`}>{status || '—'}</span>
}

function formatWhen(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

const sendTargets = [
  { value: 'all_users', label: 'All users' },
  { value: 'all_riders', label: 'All riders' },
  { value: 'all_drivers', label: 'All drivers' },
  { value: 'specific_user', label: 'Specific user' },
  { value: 'specific_rider', label: 'Specific rider' },
  { value: 'specific_driver', label: 'Specific driver' },
]

/** Canonical `type` values (see docs/notifications/payload-schema.md) + admin helper */
const notificationTypeOptions = [
  { value: 'admin_broadcast', label: 'Admin broadcast' },
  { value: 'message', label: 'Message' },
  { value: 'chat', label: 'Chat' },
  { value: 'push-message', label: 'Push message' },
  { value: 'ride', label: 'Ride' },
  { value: 'trip', label: 'Trip' },
  { value: 'dispatch', label: 'Dispatch' },
  { value: 'parcel', label: 'Parcel' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'payment', label: 'Payment' },
  { value: 'refund', label: 'Refund' },
  { value: 'payout', label: 'Payout' },
  { value: 'report', label: 'Report' },
  { value: 'kyc', label: 'KYC' },
  { value: 'safety', label: 'Safety' },
  { value: 'city', label: 'City' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'ops', label: 'Ops' },
  { value: 'rating', label: 'Rating' },
  { value: 'review', label: 'Review' },
  { value: '__custom__', label: 'Custom…' },
]

function NotificationsPage() {
  const { data: globalStats, isFetching: globalLoading } = useAdminGlobalNotificationStatsQuery()
  const { data: myStats, isFetching: myStatsLoading } = useMyNotificationStatsQuery()
  const { data: notifications = [], isFetching: listLoading } = useMyNotificationsQuery(200)

  const [sendTarget, setSendTarget] = useState('all_users')
  const [sendRecipient, setSendRecipient] = useState('')
  const [sendTypeSelect, setSendTypeSelect] = useState('admin_broadcast')
  const [sendTypeCustom, setSendTypeCustom] = useState('')
  const [sendTitle, setSendTitle] = useState('')
  const [sendBody, setSendBody] = useState('')
  const [sendChannel, setSendChannel] = useState('push')
  const [sendPayloadText, setSendPayloadText] = useState('')
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState('')
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [bulkConfirmText, setBulkConfirmText] = useState('')
  const [recipientQuery, setRecipientQuery] = useState('')
  const [debouncedRecipientQ, setDebouncedRecipientQ] = useState('')
  const [recipientMenuOpen, setRecipientMenuOpen] = useState(false)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const [sendNotification, sendState] = useAdminSendNotificationMutation()
  const [markReceived, markReceivedState] = useMarkNotificationReceivedMutation()
  const [markDelivered, markDeliveredState] = useMarkNotificationDeliveredMutation()
  const [markRead, markReadState] = useMarkNotificationReadMutation()

  const isSpecificTarget = sendTarget.startsWith('specific_')
  const isBulkTarget = !isSpecificTarget

  const searchRole = useMemo(() => {
    if (sendTarget === 'specific_rider') return 'rider'
    if (sendTarget === 'specific_driver') return 'driver'
    return ''
  }, [sendTarget])

  useEffect(() => {
    if (!sendDialogOpen || !isSpecificTarget) return
    const t = window.setTimeout(() => setDebouncedRecipientQ(recipientQuery.trim()), 280)
    return () => window.clearTimeout(t)
  }, [recipientQuery, sendDialogOpen, isSpecificTarget])

  const shouldSearchRecipients =
    sendDialogOpen && isSpecificTarget && debouncedRecipientQ.length >= 2

  const {
    data: searchRecipients = [],
    isFetching: recipientSearchLoading,
    isError: recipientSearchError,
  } = useAdminSearchUsersQuery(
    { q: debouncedRecipientQ, role: searchRole, status: '', limit: 25 },
    { skip: !shouldSearchRecipients },
  )

  const selectedRecipient = useMemo(
    () => searchRecipients.find((u) => String(u.id) === String(sendRecipient)) || null,
    [searchRecipients, sendRecipient],
  )

  useEffect(() => {
    setSendRecipient('')
    setRecipientQuery('')
    setDebouncedRecipientQ('')
    setRecipientMenuOpen(false)
  }, [sendTarget])

  const filtered = useMemo(() => {
    let rows = [...notifications]
    if (statusFilter) {
      rows = rows.filter((n) => String(n.status) === statusFilter)
    }
    const q = search.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (n) =>
          String(n.id).includes(q) ||
          String(n.type || '').toLowerCase().includes(q) ||
          String(n.title || '').toLowerCase().includes(q) ||
          String(n.body || '').toLowerCase().includes(q) ||
          String(n.status || '').toLowerCase().includes(q),
      )
    }
    return rows
  }, [notifications, statusFilter, search])

  const onSend = async (e) => {
    e.preventDefault()
    setSendError('')
    setSendSuccess('')
    const recipientUserId = String(sendRecipient).trim()
    const effectiveType = sendTypeSelect === '__custom__' ? sendTypeCustom.trim() : sendTypeSelect
    if (!effectiveType || !sendTitle.trim() || !sendBody.trim()) {
      setSendError('Type, title, and body are required.')
      return
    }
    if (sendTypeSelect === '__custom__' && !sendTypeCustom.trim()) {
      setSendError('Enter a custom type value.')
      return
    }
    if (isSpecificTarget && !recipientUserId) {
      setSendError('Please select a recipient for specific target.')
      return
    }
    if (isBulkTarget && bulkConfirmText.trim().toUpperCase() !== 'SEND') {
      setSendError('For bulk target, type SEND to confirm.')
      return
    }
    let payload = null
    if (sendPayloadText.trim()) {
      try {
        payload = JSON.parse(sendPayloadText)
      } catch {
        setSendError('Payload must be valid JSON.')
        return
      }
    }
    try {
      const result = await sendNotification({
        target: sendTarget,
        recipientUserId: isSpecificTarget ? recipientUserId : undefined,
        type: effectiveType,
        title: sendTitle.trim(),
        body: sendBody.trim(),
        channel: sendChannel,
        payload,
      }).unwrap()
      setSendSuccess(`Sent to ${result?.sentCount ?? 0}/${result?.totalRecipients ?? 0} recipients (${result?.failedCount ?? 0} failed).`)
      setSendTitle('')
      setSendBody('')
      setSendPayloadText('')
      setSendRecipient('')
      setRecipientQuery('')
      setDebouncedRecipientQ('')
      setRecipientMenuOpen(false)
      setBulkConfirmText('')
    } catch (err) {
      setSendError(err?.data?.error || err?.error || 'Send failed')
    }
  }

  const busyId = (() => {
    if (markReceivedState.isLoading) return markReceivedState.originalArgs
    if (markDeliveredState.isLoading) return markDeliveredState.originalArgs
    if (markReadState.isLoading) return markReadState.originalArgs
    return null
  })()

  return (
    <>
    <section className="space-y-8">
      {/* Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FiLayers size={16} className="text-slate-500" />
            Platform-wide
            {globalLoading ? <span className="text-xs font-normal text-slate-400">loading…</span> : null}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Total" value={globalStats?.total} icon={FiBell} accent="from-sky-50 to-white" />
            <StatTile label="Sent" value={globalStats?.sent} icon={FiSend} />
            <StatTile label="Received" value={globalStats?.received} icon={FiInbox} />
            <StatTile label="Delivered" value={globalStats?.delivered} icon={FiPackage} />
            <StatTile label="Read" value={globalStats?.read} icon={FiEye} />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FiMail size={16} className="text-slate-500" />
            Your inbox
            {myStatsLoading ? <span className="text-xs font-normal text-slate-400">loading…</span> : null}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Total" value={myStats?.total} icon={FiBell} accent="from-indigo-50 to-white" />
            <StatTile label="Sent" value={myStats?.sent} icon={FiSend} />
            <StatTile label="Received" value={myStats?.received} icon={FiInbox} />
            <StatTile label="Delivered" value={myStats?.delivered} icon={FiPackage} />
            <StatTile label="Read" value={myStats?.read} icon={FiEye} />
          </div>
        </div>
      </div>

      {/* Inbox */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-slate-900">
              <FiSmartphone size={18} className="text-slate-500" />
              Your notifications
              {listLoading ? <span className="text-xs font-normal text-slate-400">loading…</span> : null}
            </h3>
            <p className="text-xs text-slate-500">{filtered.length} shown · use actions to advance delivery state</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="sent">sent</option>
              <option value="received">received</option>
              <option value="delivered">delivered</option>
              <option value="read">read</option>
            </select>
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
              placeholder="Search title, type, id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Title</th>
                <th className="px-3 py-3">Channel</th>
                <th className="px-3 py-3">Sent</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((n) => {
                const open = expandedId != null && String(expandedId) === String(n.id)
                const rowBusy = busyId != null && String(busyId) === String(n.id)
                return (
                  <Fragment key={n.id}>
                    <tr className="hover:bg-slate-50/80">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-expanded={open}
                          className="rounded p-1 text-slate-500 hover:bg-slate-200"
                          onClick={() => setExpandedId(open ? null : String(n.id))}
                        >
                          {open ? <FiChevronDown size={18} /> : <FiChevronRight size={18} />}
                        </button>
                      </td>
                      <td className="px-3 py-3">{statusBadge(n.status)}</td>
                      <td className="max-w-[140px] truncate px-3 py-3 font-mono text-xs text-slate-700">{n.type}</td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate-800">{n.title}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{n.channel}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{formatWhen(n.sentAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <button
                            type="button"
                            disabled={Boolean(n.receivedAt) || rowBusy}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            title="Mark received"
                            onClick={() => markReceived(n.id)}
                          >
                            <FiCheck size={12} /> Received
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(n.deliveredAt) || rowBusy}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            title="Mark delivered"
                            onClick={() => markDelivered(n.id)}
                          >
                            <FiPackage size={12} /> Delivered
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(n.readAt) || rowBusy}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            title="Mark read"
                            onClick={() => markRead(n.id)}
                          >
                            <FiEye size={12} /> Read
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50/90">
                        <td colSpan={7} className="px-4 py-4 text-xs text-slate-700">
                          <p className="mb-2 font-medium text-slate-600">ID {n.id}</p>
                          <p className="mb-2 whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <p>
                              <span className="text-slate-500">Received:</span> {formatWhen(n.receivedAt)}
                            </p>
                            <p>
                              <span className="text-slate-500">Delivered:</span> {formatWhen(n.deliveredAt)}
                            </p>
                            <p>
                              <span className="text-slate-500">Read:</span> {formatWhen(n.readAt)}
                            </p>
                            <p>
                              <span className="text-slate-500">Updated:</span> {formatWhen(n.updatedAt)}
                            </p>
                          </div>
                          <pre className="mt-3 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] text-slate-600">
                            {JSON.stringify(n.payload ?? {}, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
              {!filtered.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                    No notifications match your filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {sendDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
                  <FiSend size={18} />
                  Send notification
                </h3>
                <p className="text-sm text-slate-500">Delivers to a user by ID (FCM when tokens exist). Optional JSON payload merges into push data.</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setSendDialogOpen(false)}
                aria-label="Close send dialog"
              >
                <FiX size={18} />
              </button>
            </div>
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={onSend}>
              <div className="space-y-3 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Target audience</label>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={sendTarget} onChange={(e) => setSendTarget(e.target.value)}>
                    {sendTargets.map((target) => (
                      <option key={target.value} value={target.value}>
                        {target.label}
                      </option>
                    ))}
                  </select>
                </div>
                {isSpecificTarget ? (
                  <div className="relative lg:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">Recipient</label>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Type at least 2 characters (id, phone, email…) — results load from server"
                      value={recipientQuery}
                      autoComplete="off"
                      onChange={(e) => {
                        setRecipientQuery(e.target.value)
                        setSendRecipient('')
                        setRecipientMenuOpen(true)
                      }}
                      onFocus={() => setRecipientMenuOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setRecipientMenuOpen(false), 160)
                      }}
                    />
                    {recipientMenuOpen ? (
                      <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                        {recipientQuery.trim().length < 2 ? (
                          <li className="px-3 py-2 text-sm text-slate-500">Type at least 2 characters to search.</li>
                        ) : recipientSearchError ? (
                          <li className="px-3 py-2 text-sm text-red-600">Search failed. Try again.</li>
                        ) : recipientSearchLoading ? (
                          <li className="px-3 py-2 text-sm text-slate-500">Searching…</li>
                        ) : searchRecipients.length ? (
                          searchRecipients.map((u) => (
                            <li key={u.id}>
                              <button
                                type="button"
                                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-slate-50"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  setSendRecipient(String(u.id))
                                  setRecipientQuery(`${u.phone || '—'} · ${u.role} · #${u.id}`)
                                  setRecipientMenuOpen(false)
                                }}
                              >
                                <span className="font-medium text-slate-900">
                                  #{u.id} · {u.phone || '—'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {u.role}
                                  {u.email ? ` · ${u.email}` : ''}
                                  {u.status ? ` · ${u.status}` : ''}
                                </span>
                              </button>
                            </li>
                          ))
                        ) : (
                          <li className="px-3 py-2 text-sm text-slate-500">No users match your search.</li>
                        )}
                      </ul>
                    ) : null}
                    {sendRecipient ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                        <span>
                          Selected user ID: <strong className="text-slate-900">{sendRecipient}</strong>
                          {selectedRecipient?.status ? <span className="text-slate-400"> · {selectedRecipient.status}</span> : null}
                        </span>
                        <button
                          type="button"
                          className="text-sky-700 hover:underline"
                          onClick={() => {
                            setSendRecipient('')
                            setRecipientQuery('')
                            setDebouncedRecipientQ('')
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={sendTypeSelect}
                    onChange={(e) => setSendTypeSelect(e.target.value)}
                  >
                    {notificationTypeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {sendTypeSelect === '__custom__' ? (
                    <input
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                      placeholder="e.g. ride_update"
                      value={sendTypeCustom}
                      onChange={(e) => setSendTypeCustom(e.target.value)}
                    />
                  ) : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Channel</label>
                  <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={sendChannel} onChange={(e) => setSendChannel(e.target.value)}>
                    <option value="push">push</option>
                    <option value="in_app">in_app</option>
                  </select>
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Title</label>
                  <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={sendTitle} onChange={(e) => setSendTitle(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Body</label>
                  <textarea className="min-h-[88px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={sendBody} onChange={(e) => setSendBody(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Payload (JSON, optional)</label>
                  <textarea
                    className="min-h-[72px] w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                    placeholder='{"rideId":"1","conversationId":"2"}'
                    value={sendPayloadText}
                    onChange={(e) => setSendPayloadText(e.target.value)}
                  />
                </div>
                {isBulkTarget ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 lg:col-span-2">
                    <p className="text-xs font-medium text-amber-900">
                      You are sending to a bulk audience ({sendTargets.find((t) => t.value === sendTarget)?.label}).
                      Type <span className="font-bold">SEND</span> to confirm.
                    </p>
                    <input
                      className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
                      placeholder="Type SEND to confirm bulk send"
                      value={bulkConfirmText}
                      onChange={(e) => setBulkConfirmText(e.target.value)}
                    />
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
                <button
                  type="submit"
                  disabled={sendState.isLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  <FiSend size={16} />
                  {sendState.isLoading ? 'Sending…' : 'Send notification'}
                </button>
                <button type="button" className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700" onClick={() => setSendDialogOpen(false)}>
                  Cancel
                </button>
              </div>
              {sendError ? <p className="text-sm text-red-600 lg:col-span-2">{sendError}</p> : null}
              {sendSuccess ? <p className="text-sm text-emerald-700 lg:col-span-2">{sendSuccess}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>

    {!sendDialogOpen ? (
      <button
        type="button"
        aria-label="Send notification"
        title="Send notification"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-900/25 ring-1 ring-black/10 transition hover:bg-slate-800 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:bottom-8 sm:right-8"
        onClick={() => setSendDialogOpen(true)}
      >
        <FiSend size={22} aria-hidden />
      </button>
    ) : null}
    </>
  )
}

export default NotificationsPage
