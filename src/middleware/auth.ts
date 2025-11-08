import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserRole } from '../types';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export interface AuthRequest extends Request {
  user?: User;
  userId?: number;
  userRole?: UserRole;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Требуется аутентификация' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: payload.userId, isActive: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Пользователь не найден' });
      return;
    }

    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Недействительный токен' });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.userRole) {
      res.status(401).json({ error: 'Требуется аутентификация' });
      return;
    }

    if (!roles.includes(req.userRole)) {
      res.status(403).json({ error: 'Недостаточно прав доступа' });
      return;
    }

    next();
  };
};

// Опциональная аутентификация - устанавливает userRole если токен есть, но не требует его
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Если токена нет, просто продолжаем без установки userRole
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: payload.userId, isActive: true },
    });

    if (user) {
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
    }
    
    next();
  } catch (error) {
    // Если токен невалидный, просто продолжаем без установки userRole
    next();
  }
};


