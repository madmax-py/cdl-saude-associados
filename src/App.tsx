import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Home from './pages/Home'
import Login from './pages/Login'
import NewOrder from './pages/NewOrder'
import OrderDetail from './pages/OrderDetail'
import Orders from './pages/Orders'
import Profile from './pages/Profile'
import ServiceNetwork from './pages/ServiceNetwork'
import UserForm from './pages/UserForm'
import UserImport from './pages/UserImport'
import Users from './pages/Users'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full />
  if (!me) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Home />} />
        <Route path="guias" element={<Orders />} />
        <Route path="guias/nova" element={<NewOrder />} />
        <Route path="guias/:id" element={<OrderDetail />} />
        <Route path="usuarios" element={<Users />} />
        <Route path="usuarios/novo" element={<UserForm />} />
        <Route path="usuarios/importar" element={<UserImport />} />
        <Route path="usuarios/:id" element={<UserForm />} />
        <Route path="rede" element={<ServiceNetwork />} />
        <Route path="perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
