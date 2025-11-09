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
import { BookingStatus } from '../types';
import { Club } from './Club';
import { Berth } from './Berth';
import { Vessel } from './Vessel';
import { User } from './User';
import { Payment } from './Payment';
import { Tariff } from './Tariff';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status: BookingStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  contractPath: string; // путь к договору

  @Column({ default: false })
  autoRenewal: boolean; // автоматическое продление

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => Club, (club) => club.bookings)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @ManyToOne(() => Berth, (berth) => berth.bookings)
  @JoinColumn({ name: 'berthId' })
  berth: Berth;

  @Column()
  berthId: number;

  @ManyToOne(() => Vessel, (vessel) => vessel.bookings)
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel;

  @Column()
  vesselId: number;

  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments: Payment[];

  @ManyToOne(() => Tariff, { nullable: true })
  @JoinColumn({ name: 'tariffId' })
  tariff: Tariff;

  @Column({ nullable: true })
  tariffId: number | null;
}



