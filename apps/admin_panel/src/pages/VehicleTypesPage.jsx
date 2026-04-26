import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useVehicleTypesQuery,
  useCreateVehicleTypeMutation,
  useUpdateVehicleTypeMutation,
  useDeleteVehicleTypeMutation,
} from '../services/api'
import { FiEdit2, FiPlus, FiTrash2, FiX } from 'react-icons/fi'

const defaultForm = {
  code: '',
  name: '',
  capacity: '4',
  fareMultiplier: '1',
  isActive: true,
}

function toPayload(form) {
  return {
    code: form.code.trim().toLowerCase(),
    name: form.name.trim(),
    capacity: Number(form.capacity) || 0,
    fareMultiplier: Number(form.fareMultiplier) || 0,
    isActive: Boolean(form.isActive),
  }
}

function formFromType(row) {
  if (!row) return { ...defaultForm }
  return {
    code: row.code ?? '',
    name: row.name ?? '',
    capacity: String(row.capacity ?? ''),
    fareMultiplier: String(row.fareMultiplier ?? row.fare_multiplier ?? '1'),
    isActive: Boolean(row.isActive ?? row.is_active ?? true),
  }
}

function VehicleTypeFormFields({ form, setForm, isCreate }) {
  return (
    <>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Code *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900"
          value={form.code}
          onChange={(ev) => setForm((f) => ({ ...f, code: ev.target.value }))}
          required
          disabled={!isCreate}
          autoFocus={isCreate}
        />
        {!isCreate ? <p className="mt-0.5 text-xs text-slate-400">Code can’t be changed after creation</p> : null}
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Display name *</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          value={form.name}
          onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
          required
          autoFocus={!isCreate}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Capacity (seats)</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="1"
          step="1"
          value={form.capacity}
          onChange={(ev) => setForm((f) => ({ ...f, capacity: ev.target.value }))}
        />
      </label>
      <label className="text-sm text-slate-600">
        <span className="text-xs text-slate-500">Fare multiplier</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
          type="number"
          min="0"
          step="0.01"
          value={form.fareMultiplier}
          onChange={(ev) => setForm((f) => ({ ...f, fareMultiplier: ev.target.value }))}
        />
        <p className="mt-0.5 text-xs text-slate-400">Applied to city base+km fare (e.g. 1.0 = baseline)</p>
      </label>
      <label className="col-span-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700 sm:col-span-2">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={form.isActive}
          onChange={(ev) => setForm((f) => ({ ...f, isActive: ev.target.checked }))}
        />
        Active (shown to riders / eligible for new rides)
      </label>
    </>
  )
}

function VehicleTypesPage() {
  const { data: types = [], isLoading, isError, error, refetch } = useVehicleTypesQuery()
  const [createType, createState] = useCreateVehicleTypeMutation()
  const [updateType, updateState] = useUpdateVehicleTypeMutation()
  const [deleteType, deleteState] = useDeleteVehicleTypeMutation()

  const [form, setForm] = useState({ ...defaultForm })
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formError, setFormError] = useState('')
  const [pageError, setPageError] = useState('')
  const [search, setSearch] = useState('')

  const sorted = useMemo(
    () => [...types].sort((a, b) => String(a.name).localeCompare(String(b.name))),
    [types]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((row) => {
      const fields = [
        row.id,
        row.name,
        row.code,
        row.capacity,
        row.fareMultiplier ?? row.fare_multiplier,
        row.isActive ?? row.is_active,
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
    setForm(formFromType(row))
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
    const body = toPayload(form)
    if (!body.code) {
      setFormError('Code is required.')
      return
    }
    if (!body.name) {
      setFormError('Name is required.')
      return
    }
    try {
      if (editing) {
        const { code: _c, ...patch } = body
        await updateType({ vehicleTypeId: editing, ...patch }).unwrap()
      } else {
        await createType(body).unwrap()
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
    if (!window.confirm(`Delete vehicle type “${name}”? It will fail if it’s used on rides, parcels, or driver vehicles.`)) {
      return
    }
    setPageError('')
    try {
      await deleteType(id).unwrap()
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
      {isLoading ? <p className="text-sm text-slate-500">Loading vehicle types…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">All vehicle types</h2>
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
            placeholder="Search name, code, id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="overflow-x-auto">
          {sorted.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">
              No vehicle types yet. Tap the <strong>+</strong> button to add one.
            </p>
          ) : filtered.length === 0 && !isLoading ? (
            <p className="px-4 py-10 text-center text-sm text-slate-500">No types match your search.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 sm:px-5">ID</th>
                  <th className="px-4 py-3 sm:px-5">Name</th>
                  <th className="px-4 py-3 sm:px-5">Code</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Seats</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Fare ×</th>
                  <th className="px-4 py-3 sm:px-5">Active</th>
                  <th className="px-4 py-3 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const active = row.isActive ?? row.is_active
                  const mult = row.fareMultiplier ?? row.fare_multiplier
                  return (
                    <tr key={String(row.id)} className="text-slate-800">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600 sm:px-5">{row.id}</td>
                      <td className="px-4 py-3 font-medium sm:px-5">{row.name}</td>
                      <td className="px-4 py-3 font-mono text-xs sm:px-5">{row.code}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">{row.capacity}</td>
                      <td className="px-4 py-3 text-right tabular-nums sm:px-5">{Number(mult).toFixed(2)}</td>
                      <td className="px-4 py-3 sm:px-5">
                        {active ? (
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
            aria-labelledby="vt-dialog-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="vt-dialog-title" className="text-base font-semibold text-slate-900">
                {isEdit ? 'Edit vehicle type' : 'Add vehicle type'}
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
              <VehicleTypeFormFields form={form} setForm={setForm} isCreate={!isEdit} />
              <div className="mt-1 flex flex-wrap items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={dialogBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {isEdit ? <FiEdit2 size={16} /> : <FiPlus size={16} />}
                  {isEdit ? 'Save changes' : 'Create type'}
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
        title="Add vehicle type"
        aria-label="Add vehicle type"
      >
        <FiPlus size={26} strokeWidth={2.25} />
      </button>
    </section>
  )
}

export default VehicleTypesPage
