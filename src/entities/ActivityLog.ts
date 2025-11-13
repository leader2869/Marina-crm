import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';

export enum ActivityType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  VIEW = 'view',
  OTHER = 'other',
}

export enum EntityType {
  USER = 'user',
  CLUB = 'club',
  VESSEL = 'vessel',
  BOOKING = 'booking',
  BERTH = 'berth',
  PAYMENT = 'payment',
  TARIFF = 'tariff',
  BOOKING_RULE = 'booking_rule',
  OTHER = 'other',
}

@Entity('activity_logs')
export class ActivityLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column({
    type: 'enum',
    enum: EntityType,
  })
  entityType: EntityType;

  @Column({ nullable: true })
  entityId: number | null; // ID измененной сущности

  @Column({ type: 'text', nullable: true })
  description: string | null; // Описание действия

  @Column({ type: 'json', nullable: true })
  oldValues: Record<string, any> | null; // Старые значения (для UPDATE)

  @Column({ type: 'json', nullable: true })
  newValues: Record<string, any> | null; // Новые значения

  @Column({ type: 'text', nullable: true })
  ipAddress: string | null; // IP адрес пользователя

  @Column({ type: 'text', nullable: true })
  userAgent: string | null; // User Agent браузера

  @CreateDateColumn()
  createdAt: Date;

  // Связи
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ nullable: true })
  userId: number | null; // ID пользователя, выполнившего действие
}

