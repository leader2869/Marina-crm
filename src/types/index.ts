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
  AGENT = 'agent', // Агент
  CAPTAIN = 'captain', // Капитан
  MECHANIC = 'mechanic', // Механик
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
  CANCELLED = 'cancelled',
}

export enum AgentOrderStatus {
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AgentOrderResponseStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
  ONLINE = 'online',
}

export enum PaymentType {
  DEPOSIT = 'deposit',           // Залог
  PARTIAL = 'partial',           // Частичный платеж
  FULL = 'full',                 // Полная оплата
  MONTHLY = 'monthly',           // Помесячный платеж
  PENALTY = 'penalty',           // Пеня
  REFUND = 'refund'              // Возврат средств
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

export enum CashTransactionType {
  INCOME = 'income',   // Приход
  EXPENSE = 'expense', // Расход
}

export enum CashPaymentMethod {
  CASH = 'cash',       // Наличные
  NON_CASH = 'non_cash', // Безналичные
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



