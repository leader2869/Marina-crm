import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ClubStaffPermission, UserRole } from '../types'
import { LoadingAnimation } from './LoadingAnimation'
import {
  staffCanAccessPath,
  staffHasAnyClubAccess,
  staffHasPermission,
} from '../utils/clubStaffAccess'

interface RoleProtectedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  staffPermission?: ClubStaffPermission
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  allowedRoles,
  staffPermission,
}) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <LoadingAnimation message="Загрузка..." fullScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  if (user.role === UserRole.CLUB_STAFF) {
    if (!staffHasAnyClubAccess(user)) {
      return <Navigate to="/dashboard" replace />
    }
    if (staffPermission) {
      if (!staffHasPermission(user, staffPermission)) {
        return <Navigate to="/dashboard" replace />
      }
    } else if (!staffCanAccessPath(user, location.pathname)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}
