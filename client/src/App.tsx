import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { RoleProtectedRoute } from './components/RoleProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Clubs from './pages/Clubs'
import ClubDetails from './pages/ClubDetails'
import Vessels from './pages/Vessels'
import VesselDetails from './pages/VesselDetails'
import Bookings from './pages/Bookings'
import Finances from './pages/Finances'
import Payments from './pages/Payments'
import Users from './pages/Users'
import { UserRole } from './types'

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
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="clubs" element={<Clubs />} />
            <Route path="clubs/:id" element={<ClubDetails />} />
            <Route path="vessels" element={<Vessels />} />
            <Route path="vessels/:id" element={<VesselDetails />} />
            <Route path="bookings" element={<Bookings />} />
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
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App

