import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IncomeType, Currency } from '../types';
import { Club } from './Club';
import { Booking } from './Booking';

@Entity('incomes')
export class Income {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: IncomeType,
  })
  type: IncomeType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  invoiceNumber: string;

  @Column({ nullable: true })
  documentPath: string; // путь к документу

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.incomes)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @ManyToOne(() => Booking, (booking) => booking.payments, { nullable: true })
  @JoinColumn({ name: 'bookingId' })
  booking: Booking;

  @Column({ nullable: true })
  bookingId: number;
}



