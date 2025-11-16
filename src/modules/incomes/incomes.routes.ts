import { Router } from 'express';
import { IncomesController } from './incomes.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const incomesController = new IncomesController();

router.get(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  incomesController.getAll.bind(incomesController)
);
router.post(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  incomesController.create.bind(incomesController)
);
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  incomesController.getById.bind(incomesController)
);
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  incomesController.update.bind(incomesController)
);
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  incomesController.delete.bind(incomesController)
);

export default router;

