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
  CANCELLED = 'cancelled',
}

export enum CashTransactionType {
  INCOME = 'income',   // Приход
  EXPENSE = 'expense', // Расход
}

export enum CashPaymentMethod {
  CASH = 'cash',       // Наличные
  NON_CASH = 'non_cash', // Безналичные
}

export enum Currency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
}

export interface UserClub {
  id: number
  userId: number
  clubId: number
  club?: Club
  createdAt: string
}

export interface User {
  id: number
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  avatar?: string
  isActive?: boolean
  isValidated?: boolean
  ownedClubs?: Club[]
  vessels?: Vessel[]
  managedClub?: Club
  managedClubs?: UserClub[]
  createdAt: string
}

export interface Club {
  id: number
  name: string
  description?: string
  address: string
  latitude: number
  longitude: number
  phone?: string
  email?: string
  website?: string
  logo?: string
  totalBerths: number
  minRentalPeriod: number
  maxRentalPeriod: number
  basePrice: number
  minPricePerMonth?: number
  isActive: boolean
  isValidated?: boolean
  isSubmittedForValidation?: boolean
  rejectionComment?: string | null
  ownerId: number
  owner?: User
  berths?: Berth[]
  season?: number
  rentalMonths?: number[] | null // месяцы, в которые можно арендовать место (1-12)
  bookingRules?: string | null // правила бронирования
  createdAt: string
  updatedAt: string
}

export interface TariffBerth {
  id: number
  tariffId: number
  berthId: number
  tariff?: Tariff
  createdAt: string
}

export interface Berth {
  id: number
  number: string
  length: number
  width: number
  pricePerDay?: number
  isAvailable: boolean
  notes?: string
  clubId: number
  club?: Club
  tariffBerths?: TariffBerth[]
  createdAt: string
  updatedAt: string
}

export interface Tariff {
  id: number
  name: string
  type: TariffType
  amount: number
  season: number
  clubId: number
  months?: number[] | null // Месяца для помесячной оплаты (1-12)
  berths?: Berth[]
  createdAt: string
  updatedAt: string
}

export interface Vessel {
  id: number
  name: string
  type: string
  length: number
  width?: number
  heightAboveWaterline?: number
  registrationNumber?: string
  documentPath?: string
  technicalSpecs?: string
  photo?: string
  ownerId: number
  owner?: User
  isActive?: boolean
  isValidated?: boolean
  isSubmittedForValidation?: boolean
  rejectionComment?: string | null
  createdAt: string
  updatedAt: string
}

export interface Booking {
  id: number
  startDate: string
  endDate: string
  status: BookingStatus
  totalPrice: number
  notes?: string
  contractPath?: string
  autoRenewal: boolean
  clubId: number
  berthId: number
  vesselId: number
  vesselOwnerId: number
  club?: Club
  berth?: Berth
  vessel?: Vessel
  vesselOwner?: User
  payments?: Payment[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: number
  amount: number
  currency: string
  status: PaymentStatus
  method: string
  dueDate: string
  paidDate?: string
  transactionId?: string
  notes?: string
  penalty: number
  bookingId: number
  payerId: number
  booking?: Booking
  payer?: User
  createdAt: string
  updatedAt: string
}

export interface Income {
  id: number
  type: string
  amount: number
  currency: string
  date: string
  description?: string
  invoiceNumber?: string
  documentPath?: string
  clubId: number
  bookingId?: number
  club?: Club
  booking?: Booking
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: number
  amount: number
  currency: string
  date: string
  description?: string
  paymentMethod: string
  counterparty?: string
  receiptPhoto?: string
  attachedFiles?: string
  tags?: string
  project?: string
  isRecurring: boolean
  recurringPattern?: string
  isApproved: boolean
  approvedBy?: number
  approvedAt?: string
  clubId: number
  categoryId: number
  createdById: number
  club?: Club
  category?: ExpenseCategory
  createdBy?: User
  createdAt: string
  updatedAt: string
}

export interface ExpenseCategory {
  id: number
  name: string
  description?: string
  type: string
  icon?: string
  color?: string
  parentId?: number
  isActive: boolean
  clubId?: number
  parent?: ExpenseCategory
  children?: ExpenseCategory[]
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: number
  name: string
  startDate: string
  endDate: string
  plannedIncome: number
  plannedExpense: number
  currency: string
  notes?: string
  clubId: number
  categoryId?: number
  club?: Club
  category?: ExpenseCategory
  createdAt: string
  updatedAt: string
}

export interface VesselOwnerCash {
  id: number
  name: string
  description?: string
  isActive: boolean
  vesselOwnerId: number
  vesselOwner?: User
  vesselId?: number
  vessel?: Vessel
  transactions?: CashTransaction[]
  createdAt: string
  updatedAt: string
}

export interface CashTransaction {
  id: number
  cashId: number
  transactionType: CashTransactionType
  amount: number
  currency: string
  paymentMethod: CashPaymentMethod
  date: string
  description?: string
  counterparty?: string
  documentPath?: string
  cash?: VesselOwnerCash
  createdAt: string
  updatedAt: string
}

export interface CashBalance {
  cashId: number
  cashName: string
  totalIncome: number
  totalExpense: number
  balance: number
  balanceByPaymentMethod: {
    cash: number
    non_cash: number
  }
}

export interface IncomeCategory {
  id: number
  name: string
  description?: string
  isActive: boolean
  vesselOwnerId: number
  vesselOwner?: User
  createdAt: string
  updatedAt: string
}

export interface Income {
  id: number
  categoryId: number
  category?: IncomeCategory
  vesselId: number
  vessel?: Vessel
  cashId: number
  cash?: VesselOwnerCash
  amount: number
  currency: string
  paymentMethod: CashPaymentMethod
  date: string
  description?: string
  counterparty?: string
  documentPath?: string
  createdAt: string
  updatedAt: string
}

