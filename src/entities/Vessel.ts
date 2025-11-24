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
import { Booking } from './Booking';

@Entity('vessels')
export class Vessel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  type: string; // яхта, катер, лодка и т.д.

  @Column({ type: 'decimal', precision: 8, scale: 2 })
  length: number; // длина в метрах

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  width: number; // ширина в метрах

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  heightAboveWaterline: number; // высота над ватерлинией в метрах

  @Column({ type: 'int' })
  passengerCapacity: number; // пассажировместимость (обязательное поле)

  @Column({ nullable: true })
  registrationNumber: string;

  @Column({ nullable: true })
  documentPath: string; // путь к регистрационным документам

  @Column({ type: 'text', nullable: true })
  technicalSpecs: string; // JSON с техническими характеристиками

  @Column({ type: 'text', nullable: true })
  photos: string | null; // JSON массив строк с base64 фотографиями

  @Column({ type: 'int', nullable: true })
  mainPhotoIndex: number | null; // Индекс главного фото в массиве photos

  @Column({ type: 'int', default: 0 })
  sortOrder: number; // Порядок сортировки для ручного изменения порядка катеров

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isValidated: boolean; // валидировано ли судно суперадминистратором

  @Column({ default: false })
  isSubmittedForValidation: boolean; // отправлено ли судно на валидацию владельцем

  @Column({ type: 'text', nullable: true })
  rejectionComment: string | null; // комментарий об отказе в валидации

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Связи
  @ManyToOne(() => User, (user) => user.vessels)
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column()
  ownerId: number;

  @OneToMany(() => Booking, (booking) => booking.vessel)
  bookings: Booking[];
}



