import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User';
import { Vessel } from './Vessel';
import { AgentOrder } from './AgentOrder';

export enum AgentOrderResponseStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('agent_order_responses')
export class AgentOrderResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true })
  message: string | null; // Сообщение от владельца катера

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  proposedPrice: number | null; // Предложенная цена

  @Column({
    type: 'enum',
    enum: AgentOrderResponseStatus,
    default: AgentOrderResponseStatus.PENDING,
  })
  status: AgentOrderResponseStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => AgentOrder, (order) => order.responses)
  @JoinColumn({ name: 'orderId' })
  order: AgentOrder;

  @Column()
  orderId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'vesselOwnerId' })
  vesselOwner: User;

  @Column()
  vesselOwnerId: number;

  @ManyToOne(() => Vessel)
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel;

  @Column()
  vesselId: number;
}

