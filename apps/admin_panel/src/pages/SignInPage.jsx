import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useSignInMutation } from '../services/api'
import { setAuth } from '../store/authSlice'

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

  return (
    <div className="mx-auto mt-20 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Admin Sign In</h2>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" type="submit" disabled={signInState.isLoading}>
          {signInState.isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      {signInState.error && (
        <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{signInState.error?.data?.error || signInState.error?.error || 'Sign-in failed'}</p>
      )}
    </div>
  )
}

export default SignInPage
