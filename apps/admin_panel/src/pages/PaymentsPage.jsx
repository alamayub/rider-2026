import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { usePaymentMethodsGroupedQuery, useReconciliationQuery } from '../services/api'
import {
  FiAlertCircle,
  FiCreditCard,
  FiDollarSign,
  FiLayers,
  FiPieChart,
  FiTrendingDown,
  FiTruck,
} from 'react-icons/fi'

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

const STATUS_BADGE = {
  created: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-900',
  processing: 'bg-sky-100 text-sky-900',
  succeeded: 'bg-emerald-100 text-emerald-900',
  failed: 'bg-red-100 text-red-900',
  cancelled: 'bg-slate-200 text-slate-700',
  partially_refunded: 'bg-violet-100 text-violet-900',
  refunded: 'bg-indigo-100 text-indigo-900',
}

function statusBadgeClass(status) {
  return STATUS_BADGE[status] || 'bg-slate-100 text-slate-700'
}

const GROUP_META = [
  { key: 'wallets', title: 'Wallets', description: 'Mobile wallets & e-money', accent: 'from-emerald-50/90 to-white', border: 'border-emerald-100' },
  { key: 'bankTransfer', title: 'Bank transfer', description: 'Bank rails & ConnectIPS', accent: 'from-sky-50/90 to-white', border: 'border-sky-100' },
  { key: 'cards', title: 'Cards', description: 'Card networks', accent: 'from-violet-50/90 to-white', border: 'border-violet-100' },
  { key: 'others', title: 'Other', description: 'Additional methods', accent: 'from-slate-50 to-white', border: 'border-slate-100' },
]

function MethodRow({ method }) {
  const scopes = Array.isArray(method.appScopes) ? method.appScopes : []
  const countries = Array.isArray(method.countries) ? method.countries : []
  const currencies = Array.isArray(method.currencies) ? method.currencies : []
  return (
    <div className="flex flex-col gap-2 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{method.displayName || method.methodCode || '—'}</p>
        <p className="mt-0.5 font-mono text-xs text-slate-500">
          {method.provider} · {method.methodCode}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-700">{method.category || '—'}</span>
        {method.isActive ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">Active</span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">Inactive</span>
        )}
        {scopes.slice(0, 4).map((s) => (
          <span key={s} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-600 ring-1 ring-slate-200">
            {s}
          </span>
        ))}
        <span className="text-[11px] text-slate-400">
          {countries.join(', ')} · {currencies.join(', ')}
        </span>
      </div>
    </div>
  )
}

function PaymentsPage() {
  const {
    data: reconciliation = {},
    isFetching: reconLoading,
    isError: reconError,
  } = useReconciliationQuery()
  const {
    data: grouped = {},
    isFetching: groupedLoading,
    isError: groupedError,
  } = usePaymentMethodsGroupedQuery('admin')

  const summary = reconciliation?.summary ?? {}
  const pendingPayouts = Array.isArray(reconciliation?.pendingPayouts) ? reconciliation.pendingPayouts : []
  const statusEntries = useMemo(() => Object.entries(summary.paymentStatusCounts || {}), [summary.paymentStatusCounts])

  return (
    <section className="space-y-8">
      {(reconError || groupedError) && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <FiAlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden />
          <span>Some data failed to load. Check your session and API, then reload the page.</span>
        </div>
      )}

      {/* Reconciliation summary */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FiPieChart size={17} className="text-slate-500" aria-hidden />
            Reconciliation
            {reconLoading ? <span className="text-xs font-normal text-slate-400">loading…</span> : null}
          </h3>
        </div>
        <div className="p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Total payments"
              value={summary.totalPayments ?? '—'}
              sub="All records in payments table"
              icon={FiCreditCard}
              accent="from-sky-50/80 to-white"
            />
            <StatTile
              label="Captured volume"
              value={formatMoney(summary.totalCapturedAmount)}
              sub="Succeeded + refunded states"
              icon={FiDollarSign}
              accent="from-emerald-50/80 to-white"
            />
            <StatTile
              label="Refunded (sum)"
              value={formatMoney(summary.totalRefundedAmount)}
              sub="Refunded amounts rolled up"
              icon={FiTrendingDown}
              accent="from-amber-50/80 to-white"
            />
            <StatTile
              label="Pending payouts"
              value={formatMoney(summary.totalPendingPayoutAmount)}
              sub="Ledger rows awaiting settlement"
              icon={FiTruck}
              accent="from-violet-50/80 to-white"
            />
          </div>

          {statusEntries.length > 0 ? (
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">By status</p>
              <div className="flex flex-wrap gap-2">
                {statusEntries.map(([status, count]) => (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(status)}`}
                  >
                    <span className="capitalize">{status.replace(/_/g, ' ')}</span>
                    <span className="tabular-nums opacity-80">{count}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Pending payouts */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FiLayers size={17} className="text-slate-500" aria-hidden />
            Pending payout queue
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{pendingPayouts.length}</span>
          </h3>
          <p className="mt-1 text-xs text-slate-500">Driver payouts in <span className="font-medium">pending</span> status</p>
        </div>
        <div className="overflow-x-auto">
          {pendingPayouts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500 sm:px-5">No pending payouts. You&apos;re all caught up.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">ID</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingPayouts.map((row) => (
                  <tr key={String(row.id)} className="hover:bg-slate-50/80">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700 sm:px-5">{row.id}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{row.paymentId}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{row.driverId}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-slate-900">
                      {formatMoney(row.amount, row.currency || 'NPR')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{formatWhen(row.createdAt)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-xs text-slate-600" title={row.note || ''}>
                      {row.note || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex justify-end border-t border-slate-100 px-4 py-3 sm:px-5">
          <NavLink to="/ledger" className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline">
            Full payout ledger →
          </NavLink>
        </div>
      </div>

      {/* Grouped methods */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Payment methods (admin · NP · NPR)</h3>
          {groupedLoading ? <span className="text-xs text-slate-400">loading…</span> : null}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {GROUP_META.map(({ key, title, description, accent, border }) => {
            const list = Array.isArray(grouped?.[key]) ? grouped[key] : []
            return (
              <div
                key={key}
                className={`overflow-hidden rounded-2xl border bg-gradient-to-br shadow-sm ${border} ${accent}`}
              >
                <div className="border-b border-slate-100/80 bg-white/60 px-4 py-3 backdrop-blur-sm sm:px-5">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{list.length} method{list.length === 1 ? '' : 's'}</p>
                </div>
                <div className="bg-white/90 px-4 sm:px-5">
                  {list.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500">None in this group.</p>
                  ) : (
                    list.map((m) => <MethodRow key={String(m.id ?? `${m.provider}-${m.methodCode}`)} method={m} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <details className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">Raw API payloads</summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {JSON.stringify(reconciliation ?? {}, null, 2)}
          </pre>
          <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {JSON.stringify(grouped ?? {}, null, 2)}
          </pre>
        </div>
      </details>
    </section>
  )
}

export default PaymentsPage
