import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { FiAlertCircle, FiChevronLeft } from 'react-icons/fi'
import { usePayoutLedgerQuery } from '../services/api'

function formatMoney(amount, currency = 'NPR') {
  const n = Number(amount || 0)
  if (!Number.isFinite(n)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

function formatWhen(value) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return String(value)
  }
}

const STATUS_BADGE = {
  pending: 'bg-amber-100 text-amber-900',
  paid: 'bg-emerald-100 text-emerald-900',
  completed: 'bg-emerald-100 text-emerald-900',
  processing: 'bg-sky-100 text-sky-900',
  failed: 'bg-red-100 text-red-900',
  cancelled: 'bg-slate-200 text-slate-700',
}

function statusBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-700'
}

function PayoutLedgerPage() {
  const [status, setStatus] = useState('')
  const [driverIdInput, setDriverIdInput] = useState('')
  const [driverId, setDriverId] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDriverId(driverIdInput.trim()), 450)
    return () => window.clearTimeout(t)
  }, [driverIdInput])

  const queryArgs = useMemo(
    () => ({
      ...(status ? { status } : {}),
      ...(driverId ? { driverId } : {}),
      limit: 500,
    }),
    [status, driverId],
  )

  const { data, isFetching, isError } = usePayoutLedgerQuery(queryArgs)
  const rows = Array.isArray(data?.ledger) ? data.ledger : []

  return (
    <section className="space-y-6">
      {isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <FiAlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden />
          <span>Could not load ledger. Check your session and try again.</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
            Status
            <select
              className="min-w-[10rem] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-slate-600 sm:max-w-xs">
            Driver ID
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
              placeholder="Filter by driver user id"
              value={driverIdInput}
              onChange={(e) => setDriverIdInput(e.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:justify-end">
          <span className="text-xs text-slate-500" aria-live="polite">
            {rows.length} row{rows.length === 1 ? '' : 's'}
            {isFetching ? <span className="ml-2 text-slate-400">· updating…</span> : null}
          </span>
          <NavLink
            to="/payments"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-900"
          >
            <FiChevronLeft size={16} aria-hidden />
            Payments
          </NavLink>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {!rows.length ? (
            <p className="px-4 py-12 text-center text-sm text-slate-500 sm:px-5">No ledger rows for this filter.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">ID</th>
                  <th className="px-4 py-3">Payment / parcel</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 sm:px-5">{row.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">
                      {row.paymentId ? row.paymentId : row.parcelId ? `parcel:${row.parcelId}` : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{row.driverId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatMoney(row.amount, row.currency || 'NPR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(row.status)}`}>
                        {row.status || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatWhen(row.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatWhen(row.updatedAt)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-xs text-slate-600" title={row.note || ''}>
                      {row.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}

export default PayoutLedgerPage
