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
import { UserClub } from './UserClub';
import { VesselOwnerCash } from './VesselOwnerCash';
import { IncomeCategory } from './IncomeCategory';
// Временно закомментировано до выполнения миграции БД
// После выполнения миграции (создание таблицы vessel_owner_expense_categories) раскомментировать:
// import { VesselOwnerExpenseCategory } from './VesselOwnerExpenseCategory';

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

  @Column({ default: true })
  isValidated: boolean; // Для CLUB_OWNER: true после валидации суперадминистратором

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

  // Связь многие-ко-многим через промежуточную таблицу
  @OneToMany(() => UserClub, (userClub) => userClub.user)
  managedClubs: UserClub[];

  @OneToMany(() => VesselOwnerCash, (cash) => cash.vesselOwner)
  vesselOwnerCashes: VesselOwnerCash[];

  @OneToMany(() => IncomeCategory, (category) => category.vesselOwner)
  incomeCategories: IncomeCategory[];

  // Временно закомментировано до выполнения миграции БД
  // После выполнения миграции (создание таблицы vessel_owner_expense_categories) раскомментировать:
  // @OneToMany(() => VesselOwnerExpenseCategory, (category) => category.vesselOwner)
  // expenseCategories: VesselOwnerExpenseCategory[];
}



