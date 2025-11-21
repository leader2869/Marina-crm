import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Currency, CashPaymentMethod, IncomeType } from '../types';
import { IncomeCategory } from './IncomeCategory';
import { Vessel } from './Vessel';
import { VesselOwnerCash } from './VesselOwnerCash';
import { Club } from './Club';
import { Booking } from './Booking';

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn()
  id: number;

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
    nullable: true,
  })
  paymentMethod: CashPaymentMethod; // 'cash' (наличные) или 'non_cash' (безналичные)

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  counterparty: string; // Контрагент

  @Column({ nullable: true })
  invoiceNumber: string; // Номер счета/инвойса

  @Column({ type: 'text', nullable: true })
  documentPath: string; // Путь к документу

  @Column({
    type: 'enum',
    enum: IncomeType,
    nullable: true,
  })
  type: IncomeType; // Тип дохода (для доходов клубов)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи для доходов владельцев судов
  @ManyToOne(() => IncomeCategory, (category) => category.incomes, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: IncomeCategory;

  @Column({ nullable: true })
  categoryId: number;

  @ManyToOne(() => Vessel, { nullable: true })
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel;

  @Column({ nullable: true })
  vesselId: number;

  @ManyToOne(() => VesselOwnerCash, { nullable: true })
  @JoinColumn({ name: 'cashId' })
  cash: VesselOwnerCash;

  @Column({ nullable: true })
  cashId: number;

  // Связи для доходов клубов
  @ManyToOne(() => Club, (club) => club.incomes)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ nullable: true })
  clubId: number;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ nullable: true })
  bookingId: number;
}
