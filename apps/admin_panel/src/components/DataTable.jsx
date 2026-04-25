import { useEffect, useMemo, useState } from 'react'

function DataTable({
  title,
  rows,
  searchableKeys = [],
  pageSize: pageSizeProp = 8,
  hideSearch = false,
  externalQuery = '',
  renderActions,
  getRowKey,
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = pageSizeProp

  const effectiveQuery = hideSearch ? externalQuery : query

  const filtered = useMemo(() => {
    const normalized = effectiveQuery.trim().toLowerCase()
    if (!normalized) return rows || []
    return (rows || []).filter((row) =>
      searchableKeys.some((k) => String(row?.[k] ?? '').toLowerCase().includes(normalized)),
    )
  }, [effectiveQuery, rows, searchableKeys])

  useEffect(() => {
    if (hideSearch) setPage(1)
  }, [hideSearch, externalQuery])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const columns = pageRows.length ? Object.keys(pageRows[0]) : rows?.length ? Object.keys(rows[0]) : []
  const tableColCount = columns.length + (renderActions ? 1 : 0)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {!hideSearch ? (
          <input
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : null}
      </div>
      <div className="overflow-auto rounded border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-2 py-2 font-medium">
                  {c}
                </th>
              ))}
              {renderActions ? (
                <th className="px-2 py-2 font-medium text-right whitespace-nowrap">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={getRowKey ? getRowKey(row, i) : String(row.id ?? i)} className="border-t border-slate-100">
                {columns.map((c) => (
                  <td key={c} className="max-w-52 truncate px-2 py-2 text-slate-700">
                    {typeof row[c] === 'object' ? JSON.stringify(row[c]) : String(row[c] ?? '')}
                  </td>
                ))}
                {renderActions ? <td className="whitespace-nowrap px-2 py-2 text-right align-middle">{renderActions(row)}</td> : null}
              </tr>
            ))}
            {!pageRows.length && (
              <tr>
                <td className="px-2 py-3 text-slate-500" colSpan={Math.max(1, tableColCount)}>
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <p>
          {filtered.length} records • page {safePage}/{pageCount}
        </p>
        <div className="flex gap-2">
          <button className="rounded border px-2 py-1 disabled:opacity-50" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </button>
          <button
            className="rounded border px-2 py-1 disabled:opacity-50"
            disabled={safePage >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}

export default DataTable
