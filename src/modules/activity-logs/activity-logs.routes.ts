import { Router } from 'express';
import { ActivityLogsController } from './activity-logs.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const activityLogsController = new ActivityLogsController();

router.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  activityLogsController.getAll.bind(activityLogsController)
);

export default router;

