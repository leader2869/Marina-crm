import { User } from '../entities/User';

/** Поля пользователя для JWT/auth middleware — без password и токенов сброса */
export const USER_SESSION_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  avatar: true,
  isActive: true,
  isValidated: true,
  managedClubId: true,
  emailVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function omitPassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _password, ...safe } = user;
  return safe;
}

export function omitPasswordFromUser(user: User): Partial<User> {
  return omitPassword(user);
}
