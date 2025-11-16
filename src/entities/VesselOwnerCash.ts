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
import { Vessel } from './Vessel';
import { CashTransaction } from './CashTransaction';

@Entity('vessel_owner_cashes')
export class VesselOwnerCash {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Название кассы (например, "Касса капитана")

  @Column({ type: 'text', nullable: true })
  description: string; // Описание кассы

  @Column({ default: true })
  isActive: boolean; // Активна ли касса

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.vesselOwnerCashes)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;

  @ManyToOne(() => Vessel)
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel;

  @Column()
  vesselId: number;

  @OneToMany(() => CashTransaction, (transaction) => transaction.cash)
  transactions: CashTransaction[];
}

