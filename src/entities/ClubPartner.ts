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
import { ClubCashTransaction } from './ClubCashTransaction';

@Entity('club_partners')
export class ClubPartner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  sharePercent: number; // доля в процентах

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Club)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @OneToMany(() => ClubCashTransaction, (tx) => tx.acceptedByPartner)
  acceptedTransactions: ClubCashTransaction[];

  @OneToMany(() => ClubCashTransaction, (tx) => tx.paidByPartner)
  paidTransactions: ClubCashTransaction[];
}

