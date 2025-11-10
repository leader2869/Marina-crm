import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Club } from './Club';
import { Tariff } from './Tariff';

export enum BookingRuleType {
  REQUIRE_PAYMENT_MONTHS = 'require_payment_months', // Требовать оплату за несколько месяцев сразу
  MIN_BOOKING_PERIOD = 'min_booking_period', // Минимальный период бронирования
  MAX_BOOKING_PERIOD = 'max_booking_period', // Максимальный период бронирования
  REQUIRE_DEPOSIT = 'require_deposit', // Требовать залог
  CUSTOM = 'custom', // Произвольное правило
}

@Entity('booking_rules')
export class BookingRule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  description: string; // Описание правила

  @Column({
    type: 'enum',
    enum: BookingRuleType,
    default: BookingRuleType.CUSTOM,
  })
  ruleType: BookingRuleType; // Тип правила

  @Column({ type: 'json', nullable: true })
  parameters: Record<string, any> | null; // Параметры правила (например, выбранные месяцы)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.bookingRules)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @ManyToOne(() => Tariff, { nullable: true })
  @JoinColumn({ name: 'tariffId' })
  tariff: Tariff | null;

  @Column({ nullable: true })
  tariffId: number | null; // null означает, что правило применяется ко всем тарифам клуба
}

