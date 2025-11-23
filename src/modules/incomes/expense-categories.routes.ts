import { Router } from 'express';
import { ExpenseCategoriesController } from './expense-categories.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const expenseCategoriesController = new ExpenseCategoriesController();

router.get(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  expenseCategoriesController.getAll.bind(expenseCategoriesController)
);
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  expenseCategoriesController.getById.bind(expenseCategoriesController)
);
router.post(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  expenseCategoriesController.create.bind(expenseCategoriesController)
);
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  expenseCategoriesController.update.bind(expenseCategoriesController)
);
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  expenseCategoriesController.delete.bind(expenseCategoriesController)
);

export default router;

