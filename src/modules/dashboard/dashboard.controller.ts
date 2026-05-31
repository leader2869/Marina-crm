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

      const data = await dashboardService.getStats(req);

      res.json(data);
    } catch (error) {
      next(error);
    }
  }
}
