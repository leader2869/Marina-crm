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

  /** Доступ сотрудника к клубу (false — вход в разделы клуба закрыт) */
  @Column({ default: true })
  accessEnabled: boolean;

  /** Список ключей разрешённых разделов (JSON-массив строк) */
  @Column({ type: 'jsonb', nullable: true })
  permissions: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}

