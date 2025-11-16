import { Router } from 'express';
import { IncomeCategoriesController } from './income-categories.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const categoriesController = new IncomeCategoriesController();

router.get(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  categoriesController.getAll.bind(categoriesController)
);
router.post(
  '/',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  categoriesController.create.bind(categoriesController)
);
router.get(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  categoriesController.getById.bind(categoriesController)
);
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  categoriesController.update.bind(categoriesController)
);
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.VESSEL_OWNER, UserRole.SUPER_ADMIN, UserRole.ADMIN),
  categoriesController.delete.bind(categoriesController)
);

export default router;

