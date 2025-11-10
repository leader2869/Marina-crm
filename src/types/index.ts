export enum TariffType {
  SEASON_PAYMENT = 'season_payment',
  MONTHLY_PAYMENT = 'monthly_payment',
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CLUB_OWNER = 'club_owner',
  VESSEL_OWNER = 'vessel_owner',
  GUEST = 'guest',
  PENDING_VALIDATION = 'pending_validation', // Ожидает валидации суперадминистратором
}

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  ONLINE = 'online',
}

export enum IncomeType {
  RENTAL = 'rental',
  ADDITIONAL_SERVICES = 'additional_services',
  MEMBERSHIP_FEE = 'membership_fee',
  PENALTY = 'penalty',
  OTHER = 'other',
}

export enum ExpenseType {
  SALARY = 'salary',
  UTILITIES = 'utilities',
  TAXES = 'taxes',
  MAINTENANCE = 'maintenance',
  MARKETING = 'marketing',
  RENT = 'rent',
  SUPPLIES = 'supplies',
  CUSTOM = 'custom',
}

export enum Currency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}



