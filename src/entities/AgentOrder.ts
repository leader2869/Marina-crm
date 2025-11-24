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
import { AgentOrderResponse } from './AgentOrderResponse';

export enum AgentOrderStatus {
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('agent_orders')
export class AgentOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string; // Название заказа

  @Column({ type: 'text' })
  description: string; // Описание заказа

  @Column({ type: 'date' })
  startDate: Date; // Дата начала

  @Column({ type: 'date' })
  endDate: Date; // Дата окончания

  @Column({ type: 'int' })
  passengerCount: number; // Количество пассажиров

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  budget: number | null; // Бюджет заказа

  @Column({ type: 'text', nullable: true })
  route: string | null; // Маршрут

  @Column({ type: 'text', nullable: true })
  additionalRequirements: string | null; // Дополнительные требования

  @Column({
    type: 'enum',
    enum: AgentOrderStatus,
    default: AgentOrderStatus.ACTIVE,
  })
  status: AgentOrderStatus;

  @Column({ nullable: true })
  selectedVesselId: number | null; // Выбранный катер

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.agentOrders)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column()
  createdById: number;

  @ManyToOne(() => Vessel, { nullable: true })
  @JoinColumn({ name: 'selectedVesselId' })
  selectedVessel: Vessel | null;

  @OneToMany(() => AgentOrderResponse, (response) => response.order)
  responses: AgentOrderResponse[];
}

