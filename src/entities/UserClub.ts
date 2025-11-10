import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './User';
import { Club } from './Club';

@Entity('user_clubs')
@Index(['userId', 'clubId'], { unique: true })
export class UserClub {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.managedClubs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @ManyToOne(() => Club, (club) => club.managers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clubId' })
  club: Club;

  @Column()
  clubId: number;

  @CreateDateColumn()
  createdAt: Date;
}

