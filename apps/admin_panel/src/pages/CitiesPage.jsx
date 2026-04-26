import { useCallback, useEffect, useMemo, useState } from 'react'
import { useCitiesQuery, useCreateCityMutation, useUpdateCityMutation, useDeleteCityMutation } from '../services/api'
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi'

/** Preset list for the city form; region-first, then other common ISO 4217 codes. */
const CITY_CURRENCY_CHOICES = [
  { value: 'NPR', label: 'NPR – Nepalese rupee' },
  { value: 'INR', label: 'INR – Indian rupee' },
  { value: 'USD', label: 'USD – US dollar' },
  { value: 'EUR', label: 'EUR – Euro' },
  { value: 'GBP', label: 'GBP – British pound' },
  { value: 'AED', label: 'AED – UAE dirham' },
  { value: 'SAR', label: 'SAR – Saudi riyal' },
  { value: 'QAR', label: 'QAR – Qatari riyal' },
  { value: 'BDT', label: 'BDT – Bangladeshi taka' },
  { value: 'PKR', label: 'PKR – Pakistani rupee' },
  { value: 'LKR', label: 'LKR – Sri Lankan rupee' },
  { value: 'THB', label: 'THB – Thai baht' },
  { value: 'SGD', label: 'SGD – Singapore dollar' },
  { value: 'MYR', label: 'MYR – Malaysian ringgit' },
  { value: 'IDR', label: 'IDR – Indonesian rupiah' },
  { value: 'PHP', label: 'PHP – Philippine peso' },
  { value: 'JPY', label: 'JPY – Japanese yen' },
  { value: 'KRW', label: 'KRW – South Korean won' },
  { value: 'CNY', label: 'CNY – Chinese yuan' },
  { value: 'AUD', label: 'AUD – Australian dollar' },
  { value: 'NZD', label: 'NZD – New Zealand dollar' },
  { value: 'CAD', label: 'CAD – Canadian dollar' },
  { value: 'CHF', label: 'CHF – Swiss franc' },
]

const defaultForm = {
  name: '',
  code: '',
  currency: 'NPR',
  baseFare: '60',
  perKm: '16',
  supportNumber: '',
  taxPercent: '0',
}

function toPayload(form) {
  return {
    name: form.name.trim(),
    code: form.code.trim() || undefined,
    currency: (form.currency.trim() || 'NPR').toUpperCase(),
    baseFare: Number(form.baseFare) || 0,
    perKm: Number(form.perKm) || 0,
    supportNumber: form.supportNumber.trim() || null,
    taxPercent: form.taxPercent === '' ? 0 : Number(form.taxPercent),
  }
}

function formFromCity(row) {
  if (!row) return { ...defaultForm }
  return {
    name: row.name ?? '',
    code: row.code ?? '',
    currency: String(row.currency ?? 'NPR')
      .trim()
      .toUpperCase() || 'NPR',
    baseFare: String(row.baseFare ?? row.base_fare ?? ''),
    perKm: String(row.perKm ?? row.per_km ?? ''),
    supportNumber: row.supportNumber != null ? String(row.supportNumber) : row.support_number != null ? String(row.support_number) : '',
    taxPercent: String(row.taxPercent ?? row.tax_percent ?? '0'),
  }
}

function CityFormFields({ form, setForm }) {
  const currencyOptions = useMemo(() => {
    const c = (form.currency || 'NPR').trim().toUpperCase()
    const inList = CITY_CURRENCY_CHOICES.some((o) => o.value === c)
    if (c && !inList) {
      return [{ value: c, label: `${c} (saved in database)` }, ...CITY_CURRENCY_CHOICES]
    }
    return CITY_CURRENCY_CHOICES
  }, [form.currency])

  return (
    <>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Name *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          value={form.name}
          onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
          required
          autoFocus
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Code (optional)</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
          value={form.code}
          onChange={(ev) => setForm((f) => ({ ...f, code: ev.target.value }))}
          placeholder="kathmandu"
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Currency</span>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900"
          value={(form.currency || 'NPR').trim() ? (form.currency || 'NPR').trim().toUpperCase() : 'NPR'}
          onChange={(ev) => setForm((f) => ({ ...f, currency: ev.target.value }))}
        >
          {currencyOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Base fare</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.01"
          value={form.baseFare}
          onChange={(ev) => setForm((f) => ({ ...f, baseFare: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Per km</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.01"
          value={form.perKm}
          onChange={(ev) => setForm((f) => ({ ...f, perKm: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Tax %</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.1"
          value={form.taxPercent}
          onChange={(ev) => setForm((f) => ({ ...f, taxPercent: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600 sm:col-span-2">
        <span className="text-xs text-slate-500">Support number</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          value={form.supportNumber}
          onChange={(ev) => setForm((f) => ({ ...f, supportNumber: ev.target.value }))}
        />
      </label>
    </>
  )
}

function CitiesPage() {
  const { data: cities = [], isLoading, isError, error, refetch } = useCitiesQuery()
  const [createCity, createState] = useCreateCityMutation()
  const [updateCity, updateState] = useUpdateCityMutation()
  const [deleteCity, deleteState] = useDeleteCityMutation()

  const [form, setForm] = useState({ ...defaultForm })
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...cities].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [cities]
  )

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((row) => {
      const fields = [
        row.id,
        row.name,
        row.code,
        row.currency,
        row.baseFare ?? row.base_fare,
        row.perKm ?? row.per_km,
        row.taxPercent ?? row.tax_percent,
        row.supportNumber ?? row.support_number,
      ]
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
    setForm({ ...defaultForm })
    setFormError('')
    setDialogOpen(true)
  }, [])

  const startEdit = useCallback((row) => {
    setPageError('')
    setEditing(String(row.id))
    setForm(formFromCity(row))
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
    if (!form.name.trim()) {
      setFormError('Name is required.')
      return
    }
    const body = toPayload(form)
    try {
      if (editing) {
        await updateCity({ cityId: editing, ...body }).unwrap()
      } else {
        await createCity(body).unwrap()
      }
      closeDialog()
      await refetch()
    } catch (err) {
      setFormError(err?.data?.error || err?.message || 'Request failed')
    }
  }

  const onDelete = async (row) => {
    const id = String(row.id)
    const name = row.name || row.code || id
    if (!window.confirm(`Delete city “${name}”? This cannot be undone. It will fail if the city has rides, parcels, drivers, or offers.`)) {
      return
    }
    setPageError('')
    try {
      await deleteCity(id).unwrap()
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
      {isLoading ? <p className="text-sm text-slate-500">Loading cities…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">All cities</h2>
            <p className="text-xs text-slate-500">
              {search.trim() ? (
                <>
                  {filteredCities.length} of {sorted.length} match
                </>
              ) : (
                <>{sorted.length} total</>
              )}
            </p>
          </div>
          <input
            type="search"
            className="min-w-[12rem] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm sm:max-w-xs"
            placeholder="Search name, code, id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="overflow-x-auto">
          {sorted.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No cities yet. Tap the <strong>+</strong> button to add one.
            </p>
          ) : filteredCities.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No cities match your search.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">ID</th>
                  <th className="px-4 py-3 sm:px-5">Name</th>
                  <th className="px-4 py-3 sm:px-5">Code</th>
                  <th className="px-4 py-3 sm:px-5">Currency</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Base</th>
                  <th className="px-4 py-3 sm:px-5 text-right">/ km</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Tax %</th>
                  <th className="px-4 py-3 sm:px-5">Support</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCities.map((row) => (
                  <tr key={String(row.id)} className="text-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600 sm:px-5">{row.id}</td>
                    <td className="px-4 py-3 font-medium sm:px-5">{row.name}</td>
                    <td className="px-4 py-3 font-mono text-xs sm:px-5">{row.code}</td>
                    <td className="px-4 py-3 font-mono text-xs sm:px-5">{row.currency}</td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">
                      {Number(row.baseFare ?? row.base_fare).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">
                      {Number(row.perKm ?? row.per_km).toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums sm:px-5">
                      {Number(row.taxPercent ?? row.tax_percent ?? 0).toFixed(1)}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs text-slate-600 sm:px-5">
                      {row.supportNumber || row.support_number || '—'}
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
                ))}
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
            aria-labelledby="city-dialog-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="city-dialog-title" className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit city' : 'Add city'}
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
              <CityFormFields form={form} setForm={setForm} />
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={dialogBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isEdit ? <FiEdit2 size={16} /> : <FiPlus size={16} />}
                  {isEdit ? 'Save changes' : 'Create city'}
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
        title="Add city"
        aria-label="Add city"
      >
        <FiPlus size={26} strokeWidth={2.25} />
      </button>
    </section>
  )
}

export default CitiesPage
