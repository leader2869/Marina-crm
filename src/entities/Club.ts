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

  @Column({ default: true })
  isActive: boolean;

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
}


