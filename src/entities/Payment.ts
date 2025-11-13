import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentStatus, PaymentMethod, Currency, PaymentType } from '../types';
import { Booking } from './Booking';
import { User } from './User';

@Entity('payments')
export class Payment {
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
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({ type: 'date' })
  dueDate: Date; // срок оплаты

  @Column({ type: 'date', nullable: true })
  paidDate: Date; // дата оплаты

  @Column({ type: 'text', nullable: true })
  transactionId: string; // ID транзакции в платежной системе

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  penalty: number; // пеня за просрочку

  @Column({
    type: 'enum',
    enum: PaymentType,
    nullable: true,
  })
  paymentType: PaymentType | null; // Тип платежа: залог, частичный, полный, помесячный и т.д.

  @Column({ type: 'int', default: 0 })
  paymentOrder: number; // Порядок платежа (0 для залога, 1, 2, 3... для основных)

  @Column({ type: 'int', nullable: true })
  paymentMonth: number | null; // Номер месяца для помесячной оплаты (1-12)

  @Column({ nullable: true })
  refundedPaymentId: number | null; // Ссылка на исходный платеж при возврате

  @Column({ type: 'text', nullable: true })
  externalTransactionId: string | null; // ID транзакции в платежной системе (улучшение существующего transactionId)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Booking, (booking) => booking.payments)
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column()
  bookingId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'payerId' })
  payer: User;

  @Column()
  payerId: number;
}



