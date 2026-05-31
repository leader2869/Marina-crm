import { AppDataSource } from '../config/database';
import { Booking } from '../entities/Booking';
import { BookingStatus } from '../types';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.ACTIVE,
];

/** Один SQL-запрос вместо N× getByClub для списка клубов */
export async function getFreeBerthsCountsByClubIds(
  clubs: Array<{ id: number; totalBerths: number }>
): Promise<Record<number, number>> {
  if (clubs.length === 0) {
    return {};
  }

  const clubIds = clubs.map((club) => club.id);
  const rows = await AppDataSource.getRepository(Booking)
    .createQueryBuilder('booking')
    .select('booking.clubId', 'clubId')
    .addSelect('COUNT(DISTINCT booking.berthId)', 'occupied')
    .where('booking.clubId IN (:...clubIds)', { clubIds })
    .andWhere('booking.status IN (:...statuses)', { statuses: ACTIVE_BOOKING_STATUSES })
    .andWhere('booking.berthId IS NOT NULL')
    .groupBy('booking.clubId')
    .getRawMany<{ clubId: string; occupied: string }>();

  const occupiedByClub = new Map(
    rows.map((row) => [Number(row.clubId), Number(row.occupied)])
  );

  const result: Record<number, number> = {};
  for (const club of clubs) {
    const occupied = occupiedByClub.get(club.id) ?? 0;
    result[club.id] = Math.max(0, Number(club.totalBerths || 0) - occupied);
  }
  return result;
}
