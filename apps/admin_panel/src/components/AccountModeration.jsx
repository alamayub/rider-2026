import { FiMoreHorizontal, FiX } from 'react-icons/fi'
import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Per-row actions menu: audit history + status changes (parent opens dialog for status).
 * Menu is portaled with fixed positioning so overflow:auto ancestors (table shell, main layout) do not clip it.
 */
export function RowModerationMenu({ row, menuOpenId, setMenuOpenId, onViewHistory, onChooseStatus, rowBusy }) {
  const id = String(row.id)
  const open = menuOpenId === id
  const anchorRef = useRef(null)
  const [menuPos, setMenuPos] = useState(null)

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return undefined
    }

    const measure = () => {
      const el = anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }

    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  const menuPortal =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[190] cursor-default bg-transparent"
              aria-label="Close menu"
              onClick={() => setMenuOpenId(null)}
            />
            <div
              role="menu"
              className="fixed z-[200] min-w-[12.5rem] rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
              style={{ top: menuPos.top, right: menuPos.right }}
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  onViewHistory(row)
                  setMenuOpenId(null)
                }}
              >
                Account history
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
                disabled={row.status === 'active'}
                onClick={() => {
                  onChooseStatus(row, 'active')
                  setMenuOpenId(null)
                }}
              >
                Activate
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-40"
                disabled={row.status === 'suspended'}
                onClick={() => {
                  onChooseStatus(row, 'suspended')
                  setMenuOpenId(null)
                }}
              >
                Suspend…
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-sm text-red-800 hover:bg-red-50 disabled:opacity-40"
                disabled={row.status === 'banned'}
                onClick={() => {
                  onChooseStatus(row, 'banned')
                  setMenuOpenId(null)
                }}
              >
                Ban…
              </button>
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <div ref={anchorRef} className="relative inline-block text-left">
      <button
        type="button"
        disabled={rowBusy}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Row actions"
        title="Actions"
        onClick={() => setMenuOpenId(open ? null : id)}
      >
        <FiMoreHorizontal size={18} aria-hidden />
      </button>
      {menuPortal}
    </div>
  )
}

/**
 * Confirm status change; suspend/ban require a non-empty reason.
 */
export function ModerationReasonDialog({ open, mode, user, reason, setReason, loading, error, onClose, onConfirm }) {
  if (!open || !user || !mode) return null

  const needsReason = mode !== 'active'
  const titles = {
    active: 'Activate account',
    suspended: 'Suspend account',
    banned: 'Ban account',
  }
  const bodies = {
    active: 'This user will be able to use the platform again. You can add an optional note for the audit log.',
    suspended: 'Suspension requires a short reason (stored on the account action).',
    banned: 'Banning requires a clear reason (stored on the account action).',
  }

  const canSubmit = !loading && (!needsReason || reason.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="moderation-dialog-title"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 id="moderation-dialog-title" className="text-base font-semibold text-slate-900">
            {titles[mode]}
          </h3>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
            onClick={onClose}
          >
            <FiX size={18} />
          </button>
        </div>
        <p className="text-sm text-slate-600">{bodies[mode]}</p>
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800">
          <span className="font-medium">{user.phone}</span>
          <span className="text-slate-400"> · </span>
          <span className="font-mono text-xs text-slate-500">#{user.id}</span>
          <span className="text-slate-400"> · </span>
          <span className="text-xs capitalize text-slate-600">{user.status}</span>
        </p>
        <label className="mt-4 block text-xs font-medium text-slate-600">
          {needsReason ? 'Reason (required)' : 'Note (optional)'}
          <textarea
            className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm"
            rows={needsReason ? 4 : 3}
            placeholder={needsReason ? 'Explain this moderation action…' : 'Optional context for the audit log'}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              mode === 'banned' ? 'bg-red-600 hover:bg-red-700' : mode === 'suspended' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            onClick={() => void onConfirm()}
          >
            {loading ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
