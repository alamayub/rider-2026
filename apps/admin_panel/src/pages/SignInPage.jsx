import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { FiAlertCircle, FiLock, FiPhone, FiShield } from 'react-icons/fi'
import { useSignInMutation } from '../services/api'
import { setAuth } from '../store/authSlice'

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'

function SignInPage() {
  const dispatch = useDispatch()
  const [phone, setPhone] = useState('9800000000')
  const [password, setPassword] = useState('Pass@123')
  const [signIn, signInState] = useSignInMutation()

  const onSubmit = async (e) => {
    e.preventDefault()
    try {
      const result = await signIn({ phone, password, role: 'admin' }).unwrap()
      dispatch(setAuth({ user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }))
    } catch {
      // handled in UI
    }
  }

  const errMsg = signInState.error?.data?.error || signInState.error?.error || 'Sign-in failed'

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-br from-slate-100 via-white to-sky-50/50">
      <div
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-200/25 blur-3xl"
        aria-hidden
      />

      <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[420px]">
          <header className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-lg shadow-slate-900/25 ring-1 ring-white/10">
              <FiShield size={30} strokeWidth={1.5} aria-hidden />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Ride Admin</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to manage operations, users, and payments.</p>
          </header>

          <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-6 shadow-xl shadow-slate-200/40 backdrop-blur-sm sm:p-8">
            <form className="space-y-5" onSubmit={onSubmit}>
              <div>
                <label htmlFor="signin-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Phone
                </label>
                <div className="relative">
                  <FiPhone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
                  <input
                    id="signin-phone"
                    className={`${fieldClass} pl-10`}
                    placeholder="9XXXXXXXXX"
                    autoComplete="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signin-password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <div className="relative">
                  <FiLock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
                  <input
                    id="signin-password"
                    className={`${fieldClass} pl-10`}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {signInState.error ? (
                <div
                  className="flex gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-800"
                  role="alert"
                >
                  <FiAlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden />
                  <span>{errMsg}</span>
                </div>
              ) : null}

              <button
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-slate-900/20 transition hover:from-slate-700 hover:to-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55"
                type="submit"
                disabled={signInState.isLoading}
              >
                {signInState.isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
                    Signing in…
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs text-slate-400">Secure session · Admin role required</p>
        </div>
      </div>
    </div>
  )
}

export default SignInPage
