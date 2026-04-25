import { createSlice } from '@reduxjs/toolkit'

const STORAGE_KEY = 'ride_admin_auth'

function loadPersistedAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function persistAuth(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // no-op
  }
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // no-op
  }
}

const initialState = {
  user: null,
  accessToken: '',
  refreshToken: '',
}
const restoredState = loadPersistedAuth() || initialState

const authSlice = createSlice({
  name: 'auth',
  initialState: restoredState,
  reducers: {
    setAuth: (state, action) => {
      state.user = action.payload.user || null
      state.accessToken = action.payload.accessToken || ''
      state.refreshToken = action.payload.refreshToken || ''
      persistAuth(state)
    },
    clearAuth: () => {
      clearPersistedAuth()
      return initialState
    },
  },
})

export const { setAuth, clearAuth } = authSlice.actions
export default authSlice.reducer
