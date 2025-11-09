import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tariff } from './Tariff';
import { Berth } from './Berth';

@Entity('tariff_berths')
@Index(['tariffId', 'berthId'], { unique: true })
export class TariffBerth {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Tariff, (tariff) => tariff.tariffBerths, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tariffId' })
  tariff: Tariff;

  @Column()
  tariffId: number;

  @ManyToOne(() => Berth, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'berthId' })
  berth: Berth;

  @Column()
  berthId: number;

  @CreateDateColumn()
  createdAt: Date;
}

