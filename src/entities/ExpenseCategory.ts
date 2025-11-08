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
import { ExpenseType } from '../types';
import { Expense } from './Expense';
import { Club } from './Club';

@Entity('expense_categories')
export class ExpenseCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ExpenseType,
    default: ExpenseType.CUSTOM,
  })
  type: ExpenseType;

  @Column({ nullable: true })
  icon: string; // название иконки

  @Column({ nullable: true })
  color: string; // hex цвет

  @Column({ nullable: true })
  parentId: number; // для древовидной структуры

  @ManyToOne(() => ExpenseCategory, (category) => category.children, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent: ExpenseCategory;

  @OneToMany(() => ExpenseCategory, (category) => category.parent)
  children: ExpenseCategory[];

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связь с клубом (категории могут быть общими или специфичными для клуба)
  @ManyToOne(() => Club, { nullable: true })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ nullable: true })
  clubId: number;

  @OneToMany(() => Expense, (expense) => expense.category)
  expenses: Expense[];
}


