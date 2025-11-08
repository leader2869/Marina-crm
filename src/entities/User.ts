import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserRole } from '../types';
import { Club } from './Club';
import { Vessel } from './Vessel';
import { Booking } from './Booking';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.GUEST,
  })
  role: UserRole;

  @Column({ nullable: true })
  avatar: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  resetPasswordToken: string;

  @Column({ nullable: true })
  resetPasswordExpires: Date;

  @Column({ nullable: true })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @OneToMany(() => Club, (club) => club.owner)
  ownedClubs: Club[];

  @OneToMany(() => Vessel, (vessel) => vessel.owner)
  vessels: Vessel[];

  @OneToMany(() => Booking, (booking) => booking.vesselOwner)
  bookings: Booking[];

  @ManyToOne(() => Club, (club) => club.managers, { nullable: true })
  @JoinColumn({ name: 'managedClubId' })
  managedClub: Club | null;

  @Column({ nullable: true })
  managedClubId: number | null;
}


