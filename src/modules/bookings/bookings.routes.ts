import { Router } from 'express';
import { BookingsController } from './bookings.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const bookingsController = new BookingsController();

router.get('/', authenticate, bookingsController.getAll.bind(bookingsController));
router.get('/:id', authenticate, bookingsController.getById.bind(bookingsController));
router.post('/', authenticate, bookingsController.create.bind(bookingsController));
router.put('/:id', authenticate, bookingsController.update.bind(bookingsController));
router.delete('/:id', authenticate, bookingsController.cancel.bind(bookingsController));

export default router;


