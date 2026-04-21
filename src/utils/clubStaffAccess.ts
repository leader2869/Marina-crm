import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserClub } from '../entities/UserClub';

/**
 * Проверяет, привязан ли пользователь к клубу (сотрудник: user_clubs или legacy managedClubId).
 */
export async function userHasAccessToClub(userId: number, clubId: number): Promise<boolean> {
  const userClubRepository = AppDataSource.getRepository(UserClub);
  const link = await userClubRepository.findOne({ where: { userId, clubId } });
  if (link) return true;

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId }, select: ['id', 'managedClubId'] });
  return user?.managedClubId === clubId;
}

/**
 * ID клубов, к которым у сотрудника есть доступ (через user_clubs и managedClubId).
 */
export async function getClubIdsForStaffUser(userId: number): Promise<number[]> {
  const userClubRepository = AppDataSource.getRepository(UserClub);
  const links = await userClubRepository.find({ where: { userId }, select: ['clubId'] });
  const ids = new Set(links.map((l) => l.clubId));

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId }, select: ['managedClubId'] });
  if (user?.managedClubId) ids.add(user.managedClubId);

  return Array.from(ids);
}
