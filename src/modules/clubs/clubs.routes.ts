import { Router } from 'express';
import { ClubsController } from './clubs.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const clubsController = new ClubsController();

router.get('/', clubsController.getAll.bind(clubsController));
router.get('/:id', clubsController.getById.bind(clubsController));
router.post('/', authenticate, clubsController.create.bind(clubsController));
router.put('/:id', authenticate, clubsController.update.bind(clubsController));
router.delete('/:id', authenticate, clubsController.delete.bind(clubsController));

export default router;


