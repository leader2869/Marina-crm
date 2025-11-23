import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

@Entity('vessel_owner_expense_categories')
export class VesselOwnerExpenseCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Название категории (например, "Расход на топливо")

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.expenseCategories)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;
}

