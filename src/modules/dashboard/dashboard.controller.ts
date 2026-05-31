import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { DashboardService } from './dashboard.service';

const dashboardService = new DashboardService();

export class DashboardController {
  async getStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId || !req.userRole) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const settlementsClubIdRaw = req.query.settlementsClubId;
      const settlementsClubId =
        typeof settlementsClubIdRaw === 'string' && settlementsClubIdRaw
          ? parseInt(settlementsClubIdRaw, 10)
          : undefined;

      const data = await dashboardService.getStats(
        req,
        Number.isFinite(settlementsClubId) ? settlementsClubId : undefined
      );

      res.json(data);
    } catch (error) {
      next(error);
    }
  }
}
