import { Router } from 'express';
import { PaymentsController } from './payments.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const paymentsController = new PaymentsController();

router.get('/', authenticate, paymentsController.getAll.bind(paymentsController));
router.get('/overdue', authenticate, paymentsController.getOverduePayments.bind(paymentsController));
router.get('/:id', authenticate, paymentsController.getById.bind(paymentsController));
router.post('/', authenticate, paymentsController.create.bind(paymentsController));
router.put('/:id/status', authenticate, paymentsController.updateStatus.bind(paymentsController));

export default router;


