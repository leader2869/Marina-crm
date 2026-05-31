import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { DashboardController } from './dashboard.controller';

const router = Router();
const controller = new DashboardController();

router.get('/stats', authenticate, controller.getStats.bind(controller));

export default router;
