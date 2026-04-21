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
import { ClubPartner } from './ClubPartner';
import { User } from './User';
import { ClubPartnerManager } from './ClubPartnerManager';
import { CashTransactionType, CashPaymentMethod, Currency } from '../types';

@Entity('club_cash_transactions')
export class ClubCashTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: CashTransactionType,
  })
  transactionType: CashTransactionType; // income | expense

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: Currency,
    default: Currency.RUB,
  })
  currency: Currency;

  @Column({
    type: 'enum',
    enum: CashPaymentMethod,
  })
  paymentMethod: CashPaymentMethod; // cash | non_cash

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', nullable: true })
  bookingId: number | null;

  @ManyToOne(() => Club)
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  // Кто принял деньги (для income)
  @ManyToOne(() => ClubPartner, (partner) => partner.acceptedTransactions, { nullable: true })
  @JoinColumn({ name: 'acceptedByPartnerId' })
  acceptedByPartner: ClubPartner | null;

  @Column({ type: 'integer', nullable: true })
  acceptedByPartnerId: number | null;

  // Кто оплатил из своего кармана (для expense)
  @ManyToOne(() => ClubPartner, (partner) => partner.paidTransactions, { nullable: true })
  @JoinColumn({ name: 'paidByPartnerId' })
  paidByPartner: ClubPartner | null;

  @Column({ type: 'integer', nullable: true })
  paidByPartnerId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: User | null;

  @Column({ type: 'integer', nullable: true })
  createdById: number | null;

  @ManyToOne(() => ClubPartnerManager, { nullable: true })
  @JoinColumn({ name: 'acceptedByManagerId' })
  acceptedByManager: ClubPartnerManager | null;

  @Column({ type: 'integer', nullable: true })
  acceptedByManagerId: number | null;

  // С какого менеджера списываем (для transfer)
  @ManyToOne(() => ClubPartnerManager, { nullable: true })
  @JoinColumn({ name: 'paidByManagerId' })
  paidByManager: ClubPartnerManager | null;

  @Column({ type: 'integer', nullable: true })
  paidByManagerId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

