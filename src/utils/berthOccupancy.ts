import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { BookingStatus, PaymentStatus } from '../types';

/** ID мест, занятых активными бронями или блокирующими оплатами */
export async function getOccupiedBerthIds(
  clubId: number,
  dateRange?: { start: Date; end: Date }
): Promise<Set<number>> {
  const bookingRepository = AppDataSource.getRepository(Booking);
  const queryBuilder = bookingRepository
    .createQueryBuilder('booking')
    .select('DISTINCT booking.berthId', 'berthId')
    .where('booking.clubId = :clubId', { clubId })
    .andWhere('booking.berthId IS NOT NULL')
    .andWhere(
      `(
          booking.status IN (:...statuses)
          OR EXISTS (
            SELECT 1
            FROM payments p
            WHERE p."bookingId" = booking.id
              AND p.status IN (:...blockingPaymentStatuses)
          )
        )`,
      {
        statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
        blockingPaymentStatuses: [PaymentStatus.PENDING, PaymentStatus.OVERDUE],
      }
    );

  if (dateRange) {
    queryBuilder.andWhere('(booking.startDate <= :endDate AND booking.endDate >= :startDate)', {
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
  }

  const rows = await queryBuilder.getRawMany<{ berthId: string }>();
  return new Set(
    rows.map((row) => Number(row.berthId)).filter((id) => Number.isFinite(id) && id > 0)
  );
}

export interface BerthBookingSummary {
  id: number;
  berthId: number;
  status: BookingStatus;
  clubId: number;
  totalPrice: string | number;
  notes: string | null;
  vesselOwner?: {
    id: number;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

/** Лёгкий список активных броней клуба для схемы мест (без payments/vessel/club). */
export async function getActiveBerthBookingSummaries(clubId: number): Promise<BerthBookingSummary[]> {
  const bookingRepository = AppDataSource.getRepository(Booking);
  const bookings = await bookingRepository
    .createQueryBuilder('booking')
    .select([
      'booking.id',
      'booking.berthId',
      'booking.status',
      'booking.clubId',
      'booking.totalPrice',
      'booking.notes',
    ])
    .leftJoin('booking.vesselOwner', 'vesselOwner')
    .addSelect([
      'vesselOwner.id',
      'vesselOwner.firstName',
      'vesselOwner.lastName',
      'vesselOwner.email',
      'vesselOwner.phone',
    ])
    .where('booking.clubId = :clubId', { clubId })
    .andWhere('booking.status IN (:...statuses)', {
      statuses: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.ACTIVE],
    })
    .orderBy('booking.createdAt', 'DESC')
    .getMany();

  return bookings as BerthBookingSummary[];
}
