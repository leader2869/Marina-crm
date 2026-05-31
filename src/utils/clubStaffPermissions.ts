import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserClub } from '../entities/UserClub';
import { AppError } from '../middleware/errorHandler';
import {
  ClubStaffPermission,
  DEFAULT_CLUB_STAFF_PERMISSIONS,
  normalizeStaffPermissions,
} from '../constants/clubStaffPermissions';

export interface StaffClubAccess {
  clubId: number;
  accessEnabled: boolean;
  permissions: ClubStaffPermission[];
}

const STAFF_ACCESS_CACHE_TTL_MS = 60_000;
const staffAccessCache = new Map<string, { value: StaffClubAccess | null; expiresAt: number }>();
const allStaffAccessCache = new Map<number, { value: StaffClubAccess[]; expiresAt: number }>();

function staffAccessCacheKey(userId: number, clubId: number): string {
  return `${userId}:${clubId}`;
}

export function invalidateStaffAccessCache(userId?: number, clubId?: number): void {
  if (userId === undefined && clubId === undefined) {
    staffAccessCache.clear();
    allStaffAccessCache.clear();
    return;
  }
  if (userId !== undefined) {
    allStaffAccessCache.delete(userId);
  }
  for (const key of staffAccessCache.keys()) {
    const [u, c] = key.split(':').map(Number);
    if ((userId === undefined || u === userId) && (clubId === undefined || c === clubId)) {
      staffAccessCache.delete(key);
    }
  }
}

async function findOrCreateUserClubLink(userId: number, clubId: number): Promise<UserClub | null> {
  const userClubRepository = AppDataSource.getRepository(UserClub);
  let link = await userClubRepository.findOne({ where: { userId, clubId } });
  if (link) return link;

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId }, select: ['id', 'managedClubId'] });
  if (user?.managedClubId !== clubId) return null;

  link = userClubRepository.create({
    userId,
    clubId,
    accessEnabled: true,
    permissions: [...DEFAULT_CLUB_STAFF_PERMISSIONS],
  });
  await userClubRepository.save(link);
  return link;
}

export async function getStaffClubAccess(userId: number, clubId: number): Promise<StaffClubAccess | null> {
  const key = staffAccessCacheKey(userId, clubId);
  const cached = staffAccessCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const link = await findOrCreateUserClubLink(userId, clubId);
  if (!link) {
    staffAccessCache.set(key, { value: null, expiresAt: Date.now() + STAFF_ACCESS_CACHE_TTL_MS });
    return null;
  }

  const access: StaffClubAccess = {
    clubId,
    accessEnabled: link.accessEnabled !== false,
    permissions: normalizeStaffPermissions(link.permissions),
  };
  staffAccessCache.set(key, { value: access, expiresAt: Date.now() + STAFF_ACCESS_CACHE_TTL_MS });
  return access;
}

export async function getAllStaffClubAccesses(userId: number): Promise<StaffClubAccess[]> {
  const cached = allStaffAccessCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const userClubRepository = AppDataSource.getRepository(UserClub);
  const links = await userClubRepository.find({ where: { userId } });
  const result: StaffClubAccess[] = links.map((link) => ({
    clubId: link.clubId,
    accessEnabled: link.accessEnabled !== false,
    permissions: normalizeStaffPermissions(link.permissions),
  }));

  const userRepository = AppDataSource.getRepository(User);
  const user = await userRepository.findOne({ where: { id: userId }, select: ['managedClubId'] });
  if (user?.managedClubId && !result.some((r) => r.clubId === user.managedClubId)) {
    const legacy = await getStaffClubAccess(userId, user.managedClubId);
    if (legacy) result.push(legacy);
  }

  allStaffAccessCache.set(userId, { value: result, expiresAt: Date.now() + STAFF_ACCESS_CACHE_TTL_MS });
  for (const access of result) {
    staffAccessCache.set(staffAccessCacheKey(userId, access.clubId), {
      value: access,
      expiresAt: Date.now() + STAFF_ACCESS_CACHE_TTL_MS,
    });
  }

  return result;
}

export async function staffHasPermission(
  userId: number,
  clubId: number,
  permission: ClubStaffPermission
): Promise<boolean> {
  const access = await getStaffClubAccess(userId, clubId);
  if (!access || !access.accessEnabled) return false;
  return access.permissions.includes(permission);
}

export async function staffHasAnyPermission(
  userId: number,
  clubId: number,
  permissions: ClubStaffPermission[]
): Promise<boolean> {
  for (const permission of permissions) {
    if (await staffHasPermission(userId, clubId, permission)) {
      return true;
    }
  }
  return false;
}

export async function assertStaffHasPermission(
  userId: number,
  clubId: number,
  permission: ClubStaffPermission
): Promise<void> {
  const ok = await staffHasPermission(userId, clubId, permission);
  if (!ok) {
    throw new AppError('Нет доступа к этому разделу', 403);
  }
}

export async function assertStaffClubAccessEnabled(userId: number, clubId: number): Promise<void> {
  const access = await getStaffClubAccess(userId, clubId);
  if (!access || !access.accessEnabled) {
    throw new AppError('Доступ к яхт-клубу закрыт', 403);
  }
}
