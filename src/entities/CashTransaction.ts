import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CashTransactionType, CashPaymentMethod, Currency } from '../types';
import { VesselOwnerCash } from './VesselOwnerCash';
import { IncomeCategory } from './IncomeCategory';
import { VesselOwnerExpenseCategory } from './VesselOwnerExpenseCategory';

@Entity('cash_transactions')
export class CashTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: CashTransactionType,
  })
  transactionType: CashTransactionType; // 'income' (приход) или 'expense' (расход)

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: CashPaymentMethod,
  })
  paymentMethod: CashPaymentMethod; // 'cash' (наличные) или 'non_cash' (безналичные)

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  counterparty: string; // Контрагент

  @Column({ type: 'text', nullable: true })
  documentPath: string; // Путь к документу

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => VesselOwnerCash, (cash) => cash.transactions)
  @JoinColumn({ name: 'cashId' })
  cash: VesselOwnerCash;

  @Column()
  cashId: number;

  @ManyToOne(() => IncomeCategory, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  incomeCategory: IncomeCategory | null;

  @Column({ nullable: true })
  categoryId: number | null;

  // Временно закомментировано до выполнения миграции БД
  // После выполнения миграции (создание таблицы vessel_owner_expense_categories и добавление поля expenseCategoryId)
  // раскомментировать эти строки:
  // @ManyToOne(() => VesselOwnerExpenseCategory, { nullable: true })
  // @JoinColumn({ name: 'expenseCategoryId' })
  // expenseCategory: VesselOwnerExpenseCategory | null;
  //
  // @Column({ nullable: true })
  // expenseCategoryId: number | null;
}

