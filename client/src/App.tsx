import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RoleProtectedRoute } from './components/RoleProtectedRoute'
import { LoadingAnimation } from './components/LoadingAnimation'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Clubs from './pages/Clubs'
import ClubDetails from './pages/ClubDetails'
import Vessels from './pages/Vessels'
import VesselDetails from './pages/VesselDetails'
import Bookings from './pages/Bookings'
import Tariffs from './pages/Tariffs'
import BookingRules from './pages/BookingRules'
import Finances from './pages/Finances'
import Payments from './pages/Payments'
import Users from './pages/Users'
import UserDetails from './pages/UserDetails'
import NewGuests from './pages/NewGuests'
import Validation from './pages/Validation'
import Widget from './pages/Widget'
import { UserRole } from './types'

// Компонент для редиректа на начальную страницу в зависимости от роли
function NavigateToDefault() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LoadingAnimation message="Загрузка..." fullScreen />
  }
  
  if (user?.role === UserRole.GUEST) {
    return <Navigate to="/clubs" replace />
  }
  
  return <Navigate to="/dashboard" replace />
}

// Компонент для редиректа с dashboard на clubs для Guest
function DashboardRedirect() {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <LoadingAnimation message="Загрузка..." fullScreen />
  }
  
  if (user?.role === UserRole.GUEST) {
    return <Navigate to="/clubs" replace />
  }
  
  return <Dashboard />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<NavigateToDefault />} />
            <Route path="dashboard" element={<DashboardRedirect />} />
            <Route path="clubs" element={<Clubs />} />
            <Route path="clubs/:id" element={<ClubDetails />} />
            <Route path="vessels" element={<Vessels />} />
            <Route path="vessels/:id" element={<VesselDetails />} />
            <Route path="bookings" element={<Bookings />} />
            <Route 
              path="widget" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.VESSEL_OWNER]}>
                  <Widget />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="tariffs" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.CLUB_OWNER]}>
                  <Tariffs />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="booking-rules" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.CLUB_OWNER]}>
                  <BookingRules />
                </RoleProtectedRoute>
              } 
            />
            <Route path="finances" element={<Finances />} />
            <Route path="payments" element={<Payments />} />
            <Route 
              path="users" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <Users />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="users/:id" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <UserDetails />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="new-guests" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <NewGuests />
                </RoleProtectedRoute>
              } 
            />
            <Route 
              path="validation" 
              element={
                <RoleProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
                  <Validation />
                </RoleProtectedRoute>
              } 
            />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

