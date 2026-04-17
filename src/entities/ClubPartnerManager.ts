import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Club } from './Club';
import { ClubPartner } from './ClubPartner';
import { User } from './User';

@Entity('club_partner_managers')
@Index(['clubId', 'partnerId', 'userId'], { unique: true })
export class ClubPartnerManager {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Club, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column({ type: 'integer' })
  clubId: number;

  @ManyToOne(() => ClubPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partnerId' })
  partner: ClubPartner;

  @Column({ type: 'integer' })
  partnerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
