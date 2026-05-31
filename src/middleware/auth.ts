import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: UserRole;
      file?: Express.Multer.File;
    }
  }
}

export interface AuthRequest extends Request {
  /** Не загружается из БД на каждый запрос; может быть пустым (логи активности). */
  user?: { firstName?: string; lastName?: string };
  userId?: number;
  userRole?: UserRole;
  file?: Express.Multer.File;
}

/**
 * Аутентификация только по JWT — без запроса в БД на каждый HTTP-вызов.
 * (Раньше findOne User съедал слот пула Supabase и вызывал deadlock при PG_POOL_MAX=5.)
 */
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

    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
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

export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userRole = payload.role;
    next();
  } catch {
    next();
  }
};
