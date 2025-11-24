import { Router } from 'express';
import { VesselsController } from './vessels.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const vesselsController = new VesselsController();

router.get('/', authenticate, vesselsController.getAll.bind(vesselsController));
router.post('/', authenticate, vesselsController.create.bind(vesselsController));
// ВАЖНО: Специфичные маршруты с дополнительными путями должны быть ПЕРЕД общими маршрутами с параметрами
// Маршрут update-order должен быть ПЕРЕД всеми маршрутами с :id
router.post('/update-order', (req, res, next) => {
  console.log('[Vessels Route] POST /update-order вызван');
  next();
}, authenticate, vesselsController.updateOrder.bind(vesselsController));
router.post('/:id/hide', authenticate, vesselsController.hide.bind(vesselsController));
router.post('/:id/restore', authenticate, vesselsController.restore.bind(vesselsController));
router.get('/:id', authenticate, vesselsController.getById.bind(vesselsController));
router.put('/:id', authenticate, vesselsController.update.bind(vesselsController));
router.delete('/:id', authenticate, vesselsController.delete.bind(vesselsController));

export default router;



