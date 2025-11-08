import { Router } from 'express';
import { ClubsController } from './clubs.controller';
import { authenticate, authorize, optionalAuthenticate } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const clubsController = new ClubsController();

router.get('/', optionalAuthenticate, clubsController.getAll.bind(clubsController));
router.post('/', authenticate, clubsController.create.bind(clubsController));
// ВАЖНО: Специфичные маршруты с дополнительными путями должны быть ПЕРЕД общими маршрутами с параметрами
router.post('/:id/hide', authenticate, clubsController.hide.bind(clubsController));
router.post('/:id/restore', authenticate, clubsController.restore.bind(clubsController));
router.get('/:id', clubsController.getById.bind(clubsController));
router.put('/:id', authenticate, clubsController.update.bind(clubsController));
router.delete('/:id', authenticate, clubsController.delete.bind(clubsController));

export default router;


