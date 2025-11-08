import { Router } from 'express';
import { VesselsController } from './vessels.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const vesselsController = new VesselsController();

router.get('/', authenticate, vesselsController.getAll.bind(vesselsController));
router.get('/:id', authenticate, vesselsController.getById.bind(vesselsController));
router.post('/', authenticate, vesselsController.create.bind(vesselsController));
router.put('/:id', authenticate, vesselsController.update.bind(vesselsController));
router.delete('/:id', authenticate, vesselsController.delete.bind(vesselsController));

export default router;


