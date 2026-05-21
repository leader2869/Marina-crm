/** Ключи разделов, доступных сотруднику яхт-клуба */
export const CLUB_STAFF_PERMISSION_KEYS = [
  'dashboard',
  'clubs',
  'bookings',
  'finances',
  'club_partners',
  'club_cash',
  'club_expected_incomes',
  'reports',
] as const;

export type ClubStaffPermission = (typeof CLUB_STAFF_PERMISSION_KEYS)[number];

export const DEFAULT_CLUB_STAFF_PERMISSIONS: ClubStaffPermission[] = [...CLUB_STAFF_PERMISSION_KEYS];

export const CLUB_STAFF_PERMISSION_LABELS: Record<ClubStaffPermission, string> = {
  dashboard: 'Дашборд',
  clubs: 'Яхт-клубы',
  bookings: 'Бронирования',
  finances: 'Финансы (меню)',
  club_partners: 'Партнёры',
  club_cash: 'Касса клуба',
  club_expected_incomes: 'Ожидаемые приходы',
  reports: 'Отчёты',
};

/** Маршрут → требуемое право (для club_staff) */
export const ROUTE_STAFF_PERMISSION: Record<string, ClubStaffPermission> = {
  '/dashboard': 'dashboard',
  '/clubs': 'clubs',
  '/bookings': 'bookings',
  '/finances': 'finances',
  '/club-partners': 'club_partners',
  '/club-cash': 'club_cash',
  '/club-expected-incomes': 'club_expected_incomes',
  '/reports': 'reports',
  '/reports/finance': 'reports',
  '/reports/tenants': 'reports',
};

export function normalizeStaffPermissions(raw: unknown): ClubStaffPermission[] {
  if (!Array.isArray(raw)) return [...DEFAULT_CLUB_STAFF_PERMISSIONS];
  const allowed = new Set<string>(CLUB_STAFF_PERMISSION_KEYS);
  const filtered = raw.filter((p): p is ClubStaffPermission => typeof p === 'string' && allowed.has(p));
  return filtered.length > 0 ? filtered : [...DEFAULT_CLUB_STAFF_PERMISSIONS];
}
