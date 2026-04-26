import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCouponsQuery, useCreateCouponMutation, useUpdateCouponMutation, useDeleteCouponMutation } from '../services/api'
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi'

function fromApiDatetime(s) {
  if (s == null) return ''
  const str = String(s).replace('T', ' ').trim()
  const m = str.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/)
  if (m) return `${m[1]}T${m[2]}:${m[3]}`
  return str.slice(0, 16)
}

function toApiDatetime(localStr) {
  if (!localStr) return new Date().toISOString()
  return new Date(localStr).toISOString()
}

const defaultForm = {
  code: '',
  discountType: 'percentage',
  discountValue: '10',
  maxDiscount: '',
  minFare: '0',
  startsAt: '',
  endsAt: '',
  usageLimit: '0',
  isActive: true,
}

function formFromRow(row) {
  if (!row) return { ...defaultForm }
  return {
    code: row.code ?? '',
    discountType: row.discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: String(row.discountValue ?? row.discount_value ?? ''),
    maxDiscount:
      row.maxDiscount != null && row.maxDiscount !== ''
        ? String(row.maxDiscount)
        : row.max_discount != null
          ? String(row.max_discount)
          : '',
    minFare: String(row.minFare ?? row.min_fare ?? '0'),
    startsAt: fromApiDatetime(row.startsAt ?? row.starts_at),
    endsAt: fromApiDatetime(row.endsAt ?? row.ends_at),
    usageLimit: String(row.usageLimit ?? row.usage_limit ?? '0'),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
  }
}

function toCreatePayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue) || 0,
    maxDiscount: form.maxDiscount.trim() === '' ? null : Number(form.maxDiscount),
    minFare: Number(form.minFare) || 0,
    startsAt: toApiDatetime(form.startsAt),
    endsAt: toApiDatetime(form.endsAt),
    usageLimit: form.usageLimit.trim() === '' ? 0 : Number(form.usageLimit),
    isActive: Boolean(form.isActive),
  }
}

function toUpdatePayload(form) {
  return {
    code: form.code.trim().toUpperCase(),
    discountType: form.discountType,
    discountValue: Number(form.discountValue) || 0,
    maxDiscount: form.maxDiscount.trim() === '' ? null : Number(form.maxDiscount),
    minFare: Number(form.minFare) || 0,
    startsAt: toApiDatetime(form.startsAt),
    endsAt: toApiDatetime(form.endsAt),
    usageLimit: form.usageLimit.trim() === '' ? 0 : Number(form.usageLimit),
    isActive: Boolean(form.isActive),
  }
}

function CouponFormFields({ form, setForm }) {
  return (
    <>
      <label className="text-sm text-slate-600 sm:col-span-2">
        <span className="text-xs text-slate-500">Code *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm uppercase text-slate-900"
          value={form.code}
          onChange={(ev) => setForm((f) => ({ ...f, code: ev.target.value }))}
          required
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Discount type *</span>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          value={form.discountType}
          onChange={(ev) => setForm((f) => ({ ...f, discountType: ev.target.value }))}
        >
          <option value="percentage">Percentage (% of fare)</option>
          <option value="fixed">Fixed amount</option>
        </select>
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">{form.discountType === 'percentage' ? 'Value (%)' : 'Amount'}</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step={form.discountType === 'percentage' ? '0.1' : '0.01'}
          value={form.discountValue}
          onChange={(ev) => setForm((f) => ({ ...f, discountValue: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Max discount (optional cap)</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.01"
          value={form.maxDiscount}
          onChange={(ev) => setForm((f) => ({ ...f, maxDiscount: ev.target.value }))}
          placeholder="Unlimited if empty"
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Minimum fare</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.01"
          value={form.minFare}
          onChange={(ev) => setForm((f) => ({ ...f, minFare: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Starts *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="datetime-local"
          value={form.startsAt}
          onChange={(ev) => setForm((f) => ({ ...f, startsAt: ev.target.value }))}
          required
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Ends *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="datetime-local"
          value={form.endsAt}
          onChange={(ev) => setForm((f) => ({ ...f, endsAt: ev.target.value }))}
          required
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Usage limit (0 = unlimited)</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="1"
          value={form.usageLimit}
          onChange={(ev) => setForm((f) => ({ ...f, usageLimit: ev.target.value }))}
        />
      </label>
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={form.isActive}
          onChange={(ev) => setForm((f) => ({ ...f, isActive: ev.target.checked }))}
        />
        Active
      </label>
    </>
  )
}

function formatShort(d) {
  if (d == null) return '—'
  return String(d).replace('T', ' ').slice(0, 16)
}

function CouponsPage() {
  const { data: coupons = [], isLoading, isError, error, refetch } = useCouponsQuery()
  const [createCoupon, createState] = useCreateCouponMutation()
  const [updateCoupon, updateState] = useUpdateCouponMutation()
  const [deleteCoupon, deleteState] = useDeleteCouponMutation()

  const [form, setForm] = useState({ ...defaultForm })
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...coupons].sort((a, b) => String(a.code).localeCompare(String(b.code))),
    [coupons]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((row) => {
      const used = row.usedCount ?? row.used_count ?? 0
      const fields = [row.id, row.code, row.discountType, used, row.isActive, row.minFare, row.min_fare]
      return fields.some((v) => String(v ?? '').toLowerCase().includes(q))
    })
  }, [sorted, search])

  const closeDialog = useCallback(() => {
    setDialogOpen(false)
    setEditing(null)
    setForm({ ...defaultForm })
    setFormError('')
  }, [])

  const openCreate = useCallback(() => {
    setPageError('')
    setEditing(null)
    const t = new Date()
    const end = new Date(t)
    end.setFullYear(end.getFullYear() + 1)
    setForm({
      ...defaultForm,
      startsAt: fromApiDatetime(t.toISOString()),
      endsAt: fromApiDatetime(end.toISOString()),
    })
    setFormError('')
    setDialogOpen(true)
  }, [])

  const startEdit = useCallback((row) => {
    setPageError('')
    setEditing(String(row.id))
    setForm(formFromRow(row))
    setFormError('')
    setDialogOpen(true)
  }, [])

  useEffect(() => {
    if (!dialogOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeDialog()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dialogOpen, closeDialog])

  const submit = async (e) => {
    e.preventDefault()
    setFormError('')
    if (!form.code.trim()) {
      setFormError('Code is required.')
      return
    }
    if (!form.startsAt || !form.endsAt) {
      setFormError('Start and end times are required.')
      return
    }
    try {
      if (editing) {
        await updateCoupon({ couponId: editing, ...toUpdatePayload(form) }).unwrap()
      } else {
        await createCoupon(toCreatePayload(form)).unwrap()
      }
      closeDialog()
      await refetch()
    } catch (err) {
      setFormError(err?.data?.error || err?.message || 'Request failed')
    }
  }

  const onDelete = async (row) => {
    const id = String(row.id)
    const name = row.code || id
    if (!window.confirm(`Delete coupon “${name}”? Fails if it was ever redeemed.`)) {
      return
    }
    setPageError('')
    try {
      await deleteCoupon(id).unwrap()
      if (editing === id) closeDialog()
      await refetch()
    } catch (err) {
      setPageError(err?.data?.error || err?.message || 'Delete failed')
    }
  }

  const isEdit = Boolean(editing)
  const dialogBusy = createState.isLoading || updateState.isLoading

  return (
    <section className="relative space-y-8">
      {pageError ? <p className="text-sm text-red-600">{pageError}</p> : null}
      {isError ? <p className="text-sm text-red-600">{String(error)}</p> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading coupons…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">All coupons</h2>
            <p className="text-xs text-slate-500">
              {search.trim() ? (
                <>
                  {filtered.length} of {sorted.length} match
                </>
              ) : (
                <>{sorted.length} total</>
              )}
            </p>
          </div>
          <input
            type="search"
            className="min-w-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:max-w-xs"
            placeholder="Search code, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="overflow-x-auto">
          {sorted.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No coupons yet. Tap the <strong>+</strong> button to add one.
            </p>
          ) : filtered.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No coupons match your search.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">ID</th>
                  <th className="px-4 py-3 sm:px-5">Code</th>
                  <th className="px-4 py-3 sm:px-5">Type</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Value</th>
                  <th className="px-4 py-3 sm:px-5">Window</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Used / limit</th>
                  <th className="px-4 py-3 sm:px-5">On</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const used = row.usedCount ?? row.used_count ?? 0
                  const limit = row.usageLimit ?? row.usage_limit ?? 0
                  const dt = row.discountType === 'fixed' ? 'fixed' : '%'
                  const val = row.discountValue ?? row.discount_value
                  return (
                    <tr key={String(row.id)} className="text-slate-800">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600 sm:px-5">{row.id}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium sm:px-5">{row.code}</td>
                      <td className="px-4 py-3 sm:px-5">{row.discountType || row.discount_type}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">
                        {dt === 'fixed' ? Number(val).toFixed(0) : `${Number(val).toFixed(0)}%`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 sm:px-5">
                        {formatShort(row.startsAt || row.starts_at)} → {formatShort(row.endsAt || row.ends_at)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">
                        {used} / {limit || '∞'}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        {row.isActive || row.is_active ? (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Yes</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">No</span>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(row)}
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(row)}
                            disabled={deleteState.isLoading}
                            className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            title="Delete"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          onClick={closeDialog}
          role="presentation"
        >
          <div
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-dialog-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="coupon-dialog-title" className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit coupon' : 'Add coupon'}
              </h2>
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <FiX size={20} />
              </button>
            </div>
            <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
              <CouponFormFields form={form} setForm={setForm} />
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={dialogBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isEdit ? <FiEdit2 size={16} /> : <FiPlus size={16} />}
                  {isEdit ? 'Save changes' : 'Create coupon'}
                </button>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
            {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg ring-1 ring-sky-700/10 transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        title="Add coupon"
        aria-label="Add coupon"
      >
        <FiPlus size={26} strokeWidth={2.25} />
      </button>
    </section>
  )
}

export default CouponsPage
