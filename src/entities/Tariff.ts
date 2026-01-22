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
import { Club } from './Club';
import { TariffBerth } from './TariffBerth';

export enum TariffType {
  SEASON_PAYMENT = 'season_payment', // Оплата всего сезона сразу
  MONTHLY_PAYMENT = 'monthly_payment', // Помесячная оплата
}

@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Название тарифа

  @Column({
    type: 'enum',
    enum: TariffType,
  })
  type: TariffType; // Тип тарифа

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number; // Сумма оплаты

  @Column({ type: 'int' })
  season: number; // Год сезона

  @Column({ type: 'json', nullable: true })
  months: number[] | null; // Месяца для помесячной оплаты (1-12)

  @Column({ type: 'json', nullable: true })
  monthlyAmounts: { [month: number]: number } | null; // Суммы для каждого месяца (ключ - номер месяца 1-12, значение - сумма). Используется для MONTHLY_PAYMENT

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.tariffs)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @OneToMany(() => TariffBerth, (tariffBerth) => tariffBerth.tariff)
  tariffBerths: TariffBerth[];
}

