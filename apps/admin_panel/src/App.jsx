import { useSelector } from 'react-redux'
import AdminShell from './layout/AdminShell'
import SignInPage from './pages/SignInPage'

function App() {
  const auth = useSelector((state) => state.auth)
  if (!auth.accessToken) return <SignInPage />
  return <AdminShell />
}

export default App
