import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PaymentMethod, Currency } from '../types';
import { Club } from './Club';
import { ExpenseCategory } from './ExpenseCategory';
import { User } from './User';

@Entity('expenses')
export class Expense {
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

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  counterparty: string; // контрагент

  @Column({ type: 'text', nullable: true })
  receiptPhoto: string; // путь к фото чека

  @Column({ type: 'text', nullable: true })
  attachedFiles: string; // JSON массив путей к файлам

  @Column({ type: 'text', nullable: true })
  tags: string; // JSON массив тегов

  @Column({ nullable: true })
  project: string; // проект/объект

  @Column({ default: false })
  isRecurring: boolean; // периодический расход

  @Column({ nullable: true })
  recurringPattern: string; // JSON с паттерном повторения

  @Column({ default: false })
  isApproved: boolean; // утвержден

  @Column({ nullable: true })
  approvedBy: number; // ID пользователя, утвердившего расход

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.expenses)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @ManyToOne(() => ExpenseCategory, (category) => category.expenses)
  @JoinColumn({ name: 'categoryId' })
  category: ExpenseCategory;

  @Column()
  categoryId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: number;
}


