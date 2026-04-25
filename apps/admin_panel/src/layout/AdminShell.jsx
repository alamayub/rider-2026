import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useHealthQuery } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'
import { clearAuth } from '../store/authSlice'
import { appRoutes } from './routes'
import { FiLogOut } from 'react-icons/fi'

function AdminShell() {
  const dispatch = useDispatch()
  const auth = useSelector((state) => state.auth)
  const location = useLocation()
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [socketEvents, setSocketEvents] = useState([])
  const { data: health, isFetching: healthLoading } = useHealthQuery()

  useEffect(() => {
    if (!auth.accessToken) return undefined
    const socket = connectSocket(auth.accessToken)
    const onConnect = () => setSocketStatus('connected')
    const onDisconnect = () => setSocketStatus('disconnected')
    const onMessage = (payload) => {
      setSocketEvents((prev) => [payload, ...prev].slice(0, 10))
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
    `rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`
  const activeRoute = appRoutes.find((route) => route.to === location.pathname) || appRoutes[0]

  return (
    <div className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Ride Admin Panel</h1>
            <p className="text-sm text-slate-500">Web admin for backend ops and moderation</p>
            <p className="text-xs font-medium text-slate-400">Current section: {activeRoute?.label || 'Dashboard'}</p>
          </div>
          <div className="text-right text-sm">
            <p className="text-slate-500">API Health: {healthLoading ? 'checking...' : health?.ok ? 'ok' : 'down'}</p>
            <p className="text-slate-500">Socket: {socketStatus}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 lg:grid-cols-[240px,1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="mb-2 px-3 text-xs uppercase tracking-wide text-slate-400">Navigation</p>
          <nav className="space-y-1">
            {appRoutes.map((route) => (
              <NavLink key={route.to} to={route.to} end={route.end} className={navClass}>
                <span className="flex items-center gap-2">
                  {route.icon ? <route.icon size={16} /> : null}
                  {route.label}
                </span>
              </NavLink>
            ))}
          </nav>
          <button className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600" onClick={() => dispatch(clearAuth())}>
            <span className="flex items-center justify-center gap-2">
              <FiLogOut size={16} />
              Sign Out
            </span>
          </button>
        </aside>

        <section className="space-y-6">
          <Routes>
            {appRoutes.map((route) => (
              route.index ? <Route key={route.to} index element={<route.element />} /> : <Route key={route.to} path={route.path} element={<route.element />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-900">Recent Socket Events</h3>
            <pre className="max-h-64 overflow-auto rounded bg-slate-100 p-3 text-xs text-slate-700">{JSON.stringify(socketEvents, null, 2)}</pre>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AdminShell
