export const CLUB_STAFF_PERMISSION_KEYS = [
  'dashboard',
  'clubs',
  'bookings',
  'finances',
  'club_partners',
  'club_cash',
  'club_cash_edit',
  'club_expected_incomes',
  'club_settlements',
  'reports',
] as const

export type ClubStaffPermission = (typeof CLUB_STAFF_PERMISSION_KEYS)[number]

export const DEFAULT_CLUB_STAFF_PERMISSIONS: ClubStaffPermission[] = CLUB_STAFF_PERMISSION_KEYS.filter(
  (key) => key !== 'club_cash_edit'
)

export const CLUB_STAFF_PERMISSION_LABELS: Record<ClubStaffPermission, string> = {
  dashboard: 'Дашборд',
  clubs: 'Яхт-клубы',
  bookings: 'Бронирования',
  finances: 'Финансы (меню)',
  club_partners: 'Партнёры',
  club_cash: 'Касса клуба (просмотр)',
  club_cash_edit: 'Касса: приходы и расходы',
  club_expected_incomes: 'Ожидаемые приходы',
  club_settlements: 'Взаиморасчёты',
  reports: 'Отчёты',
}

export const ROUTE_STAFF_PERMISSION: Record<string, ClubStaffPermission> = {
  '/dashboard': 'dashboard',
  '/clubs': 'clubs',
  '/bookings': 'bookings',
  '/finances': 'finances',
  '/club-partners': 'club_partners',
  '/club-cash': 'club_cash',
  '/club-expected-incomes': 'club_expected_incomes',
  '/club-settlements': 'club_settlements',
  '/reports': 'reports',
  '/reports/finance': 'reports',
  '/reports/tenants': 'reports',
}

export const FINANCE_SUB_PERMISSIONS: ClubStaffPermission[] = [
  'club_partners',
  'club_cash',
  'club_cash_edit',
  'club_expected_incomes',
  'club_settlements',
]
