import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { ActivityLogService } from '../../services/activityLog.service';
import { EntityType, ActivityType } from '../../entities/ActivityLog';
import { AppError } from '../../utils/AppError';

export class ActivityLogsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      // Только суперадминистратор может просматривать логи
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const entityType = req.query.entityType as EntityType | undefined;
      const activityType = req.query.activityType as ActivityType | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const result = await ActivityLogService.getLogs({
        page,
        limit,
        userId,
        entityType,
        activityType,
        startDate,
        endDate,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

