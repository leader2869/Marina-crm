import { AppDataSource } from '../config/database';
import { Club } from '../entities/Club';
import { AppError } from '../middleware/errorHandler';

export async function assertClubCashPaymentsEnabled(clubId: number): Promise<void> {
  const clubRepository = AppDataSource.getRepository(Club);
  const club = await clubRepository.findOne({
    where: { id: clubId },
    select: ['id', 'cashPaymentsEnabled'],
  });
  if (!club) {
    throw new AppError('Яхт-клуб не найден', 404);
  }
  if (club.cashPaymentsEnabled === false) {
    throw new AppError('Приём платежей в кассу клуба временно закрыт владельцем', 403);
  }
}
