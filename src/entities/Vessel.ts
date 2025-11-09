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
import { Booking } from './Booking';

@Entity('vessels')
export class Vessel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  type: string; // яхта, катер, лодка и т.д.

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  length: number; // длина в метрах

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  width: number; // ширина в метрах

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  heightAboveWaterline: number; // высота над ватерлинией в метрах

  @Column({ nullable: true })
  registrationNumber: string;

  @Column({ nullable: true })
  documentPath: string; // путь к регистрационным документам

  @Column({ type: 'text', nullable: true })
  technicalSpecs: string; // JSON с техническими характеристиками

  @Column({ nullable: true })
  photo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.vessels)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: number;

  @OneToMany(() => Booking, (booking) => booking.vessel)
  bookings: Booking[];
}



