import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserClub } from '../entities/UserClub';
import { getStaffClubAccess } from './clubStaffPermissions';

/**
 * Проверяет, привязан ли пользователь к клубу и не закрыт ли доступ.
 */
export async function userHasAccessToClub(userId: number, clubId: number): Promise<boolean> {
  const access = await getStaffClubAccess(userId, clubId);
  return access !== null && access.accessEnabled;
}

/**
 * ID клубов с активным доступом для сотрудника.
 */
export async function getClubIdsForStaffUser(userId: number): Promise<number[]> {
  const userClubRepository = AppDataSource.getRepository(UserClub);
  const links = await userClubRepository.find({ where: { userId } });
  const ids = new Set<number>();

  for (const link of links) {
    if (link.accessEnabled !== false) {
      ids.add(link.clubId);
    }
  }

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId }, select: ['managedClubId'] });
  if (user?.managedClubId) {
    const access = await getStaffClubAccess(userId, user.managedClubId);
    if (access?.accessEnabled) ids.add(user.managedClubId);
  }

  return Array.from(ids);
}
