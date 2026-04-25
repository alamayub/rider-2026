import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useHealthQuery } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'
import { clearAuth } from '../store/authSlice'
import { appRoutes } from './routes'
import {
  FiChevronLeft,
  FiChevronRight,
  FiCopy,
  FiLogOut,
  FiMenu,
  FiRadio,
  FiTrash2,
  FiX,
} from 'react-icons/fi'

const SOCKET_FEED_MAX = 12

function summarizeSocketPayload(data) {
  if (data == null) return 'Empty payload'
  if (typeof data === 'string') {
    const s = data.trim()
    return s.length > 100 ? `${s.slice(0, 100)}…` : s || 'Empty string'
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = data
    const bits = []
    if (o.conversationId != null) bits.push(`Conversation ${o.conversationId}`)
    if (o.id != null && o.conversationId == null) bits.push(`ID ${o.id}`)
    if (o.senderUserId != null) bits.push(`Sender ${o.senderUserId}`)
    if (o.senderId != null && o.senderUserId == null) bits.push(`Sender ${o.senderId}`)
    if (o.content != null) {
      const c = String(o.content).replace(/\s+/g, ' ').trim()
      bits.push(c.length > 72 ? `${c.slice(0, 72)}…` : c)
    }
    if (bits.length) return bits.join(' · ')
    const keys = Object.keys(o)
    return keys.length ? keys.slice(0, 6).join(', ') : '{}'
  }
  if (Array.isArray(data)) return `Array (${data.length} items)`
  return String(data)
}

function formatSocketTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return '—'
  }
}

const SIDEBAR_COLLAPSED_KEY = 'ride_admin_sidebar_collapsed'

function loadCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
}

function AdminShell() {
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)
  const location = useLocation()
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [socketEvents, setSocketEvents] = useState([])
  const [copyHint, setCopyHint] = useState(null)
  const { data: health, isFetching: healthLoading } = useHealthQuery()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadCollapsed)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!auth.accessToken) return undefined
    const socket = connectSocket(auth.accessToken)
    const onConnect = () => setSocketStatus('connected')
    const onDisconnect = () => setSocketStatus('disconnected')
    const onMessage = (payload) => {
      setSocketEvents((prev) =>
        [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            at: new Date().toISOString(),
            event: 'message:new',
            data: payload,
          },
          ...prev,
        ].slice(0, SOCKET_FEED_MAX),
      )
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('message:new', onMessage)
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('message:new', onMessage)
      disconnectSocket()
    }
  }, [auth.accessToken])

  const navClass = ({ isActive }) =>
    `flex rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
  const activeRoute = appRoutes.find((route) => route.to === location.pathname) || appRoutes[0]

  const signOutButton = (opts = {}) => {
    const { collapsed = false, className = '' } = opts
    return (
      <button
        type="button"
        className={`mt-4 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 ${collapsed ? 'flex w-full justify-center p-2' : 'w-full px-3 py-2'} ${className}`}
        title={collapsed ? 'Sign out' : undefined}
        onClick={() => dispatch(clearAuth())}
      >
        <span className="flex items-center justify-center gap-2">
          <FiLogOut size={16} aria-hidden />
          {!collapsed && 'Sign Out'}
        </span>
      </button>
    )
  }

  const sidebarInner = (collapsed, onLinkClick) => (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className={`mb-2 flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
        {!collapsed && <p className="px-1 text-xs uppercase tracking-wide text-slate-400">Navigation</p>}
        {collapsed && <span className="sr-only">Navigation</span>}
        <button
          type="button"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:flex"
          onClick={() => setSidebarCollapsed((c) => !c)}
        >
          {collapsed ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
        </button>
      </div>
      <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto">
        {appRoutes.map((route) => (
          <NavLink
            key={route.to}
            to={route.to}
            end={route.end}
            title={collapsed ? route.label : undefined}
            onClick={onLinkClick}
            className={({ isActive }) => `${navClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`}
          >
            <span className={`flex items-center gap-2 ${collapsed ? 'justify-center' : ''}`}>
              {route.icon ? <route.icon size={16} aria-hidden /> : null}
              {!collapsed && <span>{route.label}</span>}
            </span>
          </NavLink>
        ))}
      </nav>
      {signOutButton({ collapsed })}
    </div>
  )

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 flex-row overflow-hidden bg-slate-50">
      {/* Desktop sidebar — full viewport height, left column */}
      <aside
        className={`hidden min-h-0 shrink-0 self-stretch border-r border-slate-200 bg-white transition-[width] duration-200 ease-out lg:flex lg:min-h-0 lg:flex-col ${
          sidebarCollapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
      >
        {sidebarInner(sidebarCollapsed, undefined)}
      </aside>

      {/* Main column: header starts after sidebar; main scrolls below */}
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                aria-label="Open menu"
                className="mt-0.5 rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
              >
                <FiMenu size={20} />
              </button>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Ride Admin Panel</h1>
                <p className="truncate text-sm text-slate-500">Web admin for backend ops and moderation</p>
                <p className="text-xs font-medium text-slate-400">Current section: {activeRoute?.label || 'Dashboard'}</p>
              </div>
            </div>
            <div className="shrink-0 text-right text-sm">
              <p className="text-slate-500">API Health: {healthLoading ? 'checking...' : health?.ok ? 'ok' : 'down'}</p>
              <p className="text-slate-500">Socket: {socketStatus}</p>
            </div>
          </div>
        </header>

        <main className="min-h-0 w-full min-w-0 flex-1 overflow-auto px-4 py-6 sm:px-6">
          <div className="w-full max-w-none space-y-6">
            <Routes>
              {appRoutes.map((route) =>
                route.index ? (
                  <Route key={route.to} index element={<route.element />} />
                ) : (
                  <Route key={route.to} path={route.path} element={<route.element />} />
                ),
              )}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/90 to-white px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      socketStatus === 'connected'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-slate-100 text-slate-500'
                    }`}
                  >
                    <FiRadio size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900">Socket activity</h3>
                    <p className="text-xs text-slate-500">
                      Last inbound events (e.g. <code className="rounded bg-slate-100 px-1">message:new</code>) — max{' '}
                      {SOCKET_FEED_MAX}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      socketStatus === 'connected'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {socketStatus === 'connected' ? 'Live' : 'Offline'}
                  </span>
                  <button
                    type="button"
                    disabled={!socketEvents.length}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => setSocketEvents([])}
                  >
                    <FiTrash2 size={14} aria-hidden />
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {!socketEvents.length ? (
                  <div className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-600">No events yet</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
                      When the socket is connected, new chat messages will appear here with a short summary. Open the
                      Messages page and send traffic to see activity.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {socketEvents.map((entry) => (
                      <li key={entry.id} className="px-4 py-3 hover:bg-slate-50/80">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-sky-900">
                                {entry.event}
                              </span>
                              <span className="text-xs text-slate-400">{formatSocketTime(entry.at)}</span>
                            </div>
                            <p className="mt-1.5 text-sm leading-snug text-slate-700">{summarizeSocketPayload(entry.data)}</p>
                          </div>
                          <button
                            type="button"
                            title="Copy JSON"
                            className="shrink-0 rounded-lg border border-slate-200 p-2 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-800"
                            onClick={async () => {
                              try {
                                const text = JSON.stringify(entry.data ?? null, null, 2)
                                await navigator.clipboard.writeText(text)
                                setCopyHint(entry.id)
                                window.setTimeout(() => {
                                  setCopyHint((current) => (current === entry.id ? null : current))
                                }, 1600)
                              } catch {
                                /* ignore */
                              }
                            }}
                          >
                            <FiCopy size={14} aria-hidden />
                          </button>
                        </div>
                        <details className="mt-2 rounded-lg border border-slate-100 bg-slate-50/50">
                          <summary className="cursor-pointer select-none px-2 py-1.5 text-xs font-medium text-sky-800 hover:bg-slate-100/80">
                            Raw payload
                          </summary>
                          <pre className="max-h-40 overflow-auto border-t border-slate-100 p-2 font-mono text-[11px] leading-relaxed text-slate-600">
                            {JSON.stringify(entry.data ?? null, null, 2)}
                          </pre>
                        </details>
                        {copyHint === entry.id ? (
                          <p className="mt-1 text-right text-[11px] font-medium text-emerald-600">Copied</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>

      {/* Mobile overlay drawer */}
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 ease-out lg:hidden ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Navigation</p>
          <button
            type="button"
            aria-label="Close menu"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            onClick={() => setMobileNavOpen(false)}
          >
            <FiX size={20} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
          <nav className="flex flex-1 flex-col space-y-1 overflow-y-auto">
            {appRoutes.map((route) => (
              <NavLink
                key={route.to}
                to={route.to}
                end={route.end}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) => navClass({ isActive })}
              >
                <span className="flex items-center gap-2">
                  {route.icon ? <route.icon size={16} aria-hidden /> : null}
                  {route.label}
                </span>
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => dispatch(clearAuth())}
          >
            <span className="flex items-center justify-center gap-2">
              <FiLogOut size={16} aria-hidden />
              Sign Out
            </span>
          </button>
        </div>
      </aside>
    </div>
  )
}

export default AdminShell
