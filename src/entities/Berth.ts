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
import { Booking } from './Booking';
import { TariffBerth } from './TariffBerth';

@Entity('berths')
export class Berth {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: string;

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  length: number; // максимальная длина судна в метрах

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  width: number; // ширина места в метрах

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  pricePerDay: number | null; // цена за день (если отличается от базовой)

  @Column({ default: true })
  isAvailable: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.berths)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @OneToMany(() => Booking, (booking) => booking.berth)
  bookings: Booking[];

  @OneToMany(() => TariffBerth, (tariffBerth) => tariffBerth.berth)
  tariffBerths: TariffBerth[];
}



