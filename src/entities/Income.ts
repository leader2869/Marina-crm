import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Currency, CashPaymentMethod } from '../types';
import { IncomeCategory } from './IncomeCategory';
import { Vessel } from './Vessel';
import { VesselOwnerCash } from './VesselOwnerCash';

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
  })
  paymentMethod: CashPaymentMethod; // 'cash' (наличные) или 'non_cash' (безналичные)

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  counterparty: string; // Контрагент

  @Column({ type: 'text', nullable: true })
  documentPath: string; // Путь к документу

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => IncomeCategory, (category) => category.incomes)
  @JoinColumn({ name: 'categoryId' })
  category: IncomeCategory;

  @Column()
  categoryId: number;

  @ManyToOne(() => Vessel)
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel;

  @Column()
  vesselId: number;

  @ManyToOne(() => VesselOwnerCash)
  @JoinColumn({ name: 'cashId' })
  cash: VesselOwnerCash;

  @Column()
  cashId: number;
}
