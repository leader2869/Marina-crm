import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { LoadingAnimation } from './LoadingAnimation'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ 
  children, 
  allowedRoles 
}) => {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingAnimation message="Загрузка..." fullScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

