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
import { Income } from './Income';

@Entity('income_categories')
export class IncomeCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Название категории (например, "Приход от аренды катера")

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.incomeCategories)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;

  @OneToMany(() => Income, (income) => income.category)
  incomes: Income[];
}

