import {
  ClubStaffPermission,
  FINANCE_SUB_PERMISSIONS,
  ROUTE_STAFF_PERMISSION,
} from '../constants/clubStaffPermissions'
import { ClubStaffAccess, User, UserRole } from '../types'

export function getStaffPermissionsUnion(user: User | null): ClubStaffPermission[] {
  if (!user || user.role !== UserRole.CLUB_STAFF) return []
  const accesses = user.clubStaffAccesses || []
  const set = new Set<ClubStaffPermission>()
  accesses
    .filter((a) => a.accessEnabled)
    .forEach((a) => a.permissions.forEach((p) => set.add(p)))
  return Array.from(set)
}

export function staffHasAnyClubAccess(user: User | null): boolean {
  if (!user || user.role !== UserRole.CLUB_STAFF) return true
  return (user.clubStaffAccesses || []).some((a) => a.accessEnabled)
}

export function staffHasPermission(
  user: User | null,
  permission: ClubStaffPermission
): boolean {
  const perms = getStaffPermissionsUnion(user)
  return perms.includes(permission)
}

export function staffCanSeeFinancesMenu(user: User | null): boolean {
  if (!user || user.role !== UserRole.CLUB_STAFF) return true
  const perms = getStaffPermissionsUnion(user)
  return (
    perms.includes('finances') ||
    FINANCE_SUB_PERMISSIONS.some((p) => perms.includes(p))
  )
}

export function staffCanAccessPath(user: User | null, pathname: string): boolean {
  if (!user || user.role !== UserRole.CLUB_STAFF) return true
  if (!staffHasAnyClubAccess(user)) return false

  if (pathname.startsWith('/clubs/')) {
    return staffHasPermission(user, 'clubs')
  }

  const permission = ROUTE_STAFF_PERMISSION[pathname]
  if (!permission) return true

  if (pathname === '/finances') {
    return staffCanSeeFinancesMenu(user)
  }

  return staffHasPermission(user, permission)
}

export function getActiveStaffClubAccesses(user: User | null): ClubStaffAccess[] {
  return (user?.clubStaffAccesses || []).filter((a) => a.accessEnabled)
}
