import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Currency } from '../types';
import { Club } from './Club';
import { ExpenseCategory } from './ExpenseCategory';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  plannedIncome: number; // запланированный доход

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  plannedExpense: number; // запланированный расход

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.budgets)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  // Бюджет может быть привязан к категории расходов (опционально)
  @ManyToOne(() => ExpenseCategory, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category: ExpenseCategory;

  @Column({ nullable: true })
  categoryId: number;
}


