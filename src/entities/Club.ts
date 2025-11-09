import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Berth } from './Berth';
import { Booking } from './Booking';
import { Income } from './Income';
import { Expense } from './Expense';
import { Budget } from './Budget';
import { UserClub } from './UserClub';
import { Tariff } from './Tariff';
import { BookingRule } from './BookingRule';

@Entity('clubs')
export class Club {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  logo: string;

  @Column({ type: 'int', default: 0 })
  totalBerths: number;

  @Column({ type: 'int', default: 0 })
  minRentalPeriod: number; // в днях

  @Column({ type: 'int', default: 365 })
  maxRentalPeriod: number; // в днях

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  basePrice: number; // базовая цена за день

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minPricePerMonth: number | null; // минимальная цена за месяц

  @Column({ type: 'int', nullable: true })
  season: number | null; // год сезона

  @Column({ type: 'json', nullable: true })
  rentalMonths: number[] | null; // месяцы, в которые можно арендовать место (1-12)

  @Column({ type: 'text', nullable: true })
  bookingRulesText: string | null; // текстовые правила бронирования (устаревшее, используйте BookingRule)

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isValidated: boolean; // валидирован ли клуб суперадминистратором

  @Column({ default: false })
  isSubmittedForValidation: boolean; // отправлен ли клуб на валидацию владельцем

  @Column({ type: 'text', nullable: true })
  rejectionComment: string | null; // комментарий об отказе в валидации

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.ownedClubs)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: number;

  @OneToMany(() => User, (user) => user.managedClub)
  managers: User[];

  // Связь многие-ко-многим через промежуточную таблицу
  @OneToMany(() => UserClub, (userClub) => userClub.club)
  userClubs: UserClub[];

  @OneToMany(() => Berth, (berth) => berth.club)
  berths: Berth[];

  @OneToMany(() => Booking, (booking) => booking.club)
  bookings: Booking[];

  @OneToMany(() => Income, (income) => income.club)
  incomes: Income[];

  @OneToMany(() => Expense, (expense) => expense.club)
  expenses: Expense[];

  @OneToMany(() => Budget, (budget) => budget.club)
  budgets: Budget[];

  @OneToMany(() => Tariff, (tariff) => tariff.club)
  tariffs: Tariff[];

  @OneToMany(() => BookingRule, (bookingRule) => bookingRule.club)
  bookingRules: BookingRule[];
}



