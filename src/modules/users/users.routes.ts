import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const usersController = new UsersController();

// Только супер-администратор может получить список всех пользователей
router.get(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  usersController.getAll.bind(usersController)
);

// Только супер-администратор может создавать пользователей
router.post(
  '/',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  usersController.create.bind(usersController)
);

// Только супер-администратор может обновлять пользователей
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.SUPER_ADMIN),
  usersController.update.bind(usersController)
);

export default router;

