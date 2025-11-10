import { Router } from 'express';
import { BookingRulesController } from './booking-rules.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new BookingRulesController();

router.get('/club/:clubId', authenticate, controller.getByClub.bind(controller));
router.post('/', authenticate, controller.create.bind(controller));
router.put('/:id', authenticate, controller.update.bind(controller));
router.delete('/:id', authenticate, controller.delete.bind(controller));

export default router;

