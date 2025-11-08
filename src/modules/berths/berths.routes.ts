import { Router } from 'express';
import { BerthsController } from './berths.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const berthsController = new BerthsController();

// Получить все места клуба
router.get('/club/:clubId', authenticate, berthsController.getByClub.bind(berthsController));

// Создать новое место
router.post('/', authenticate, berthsController.create.bind(berthsController));

// Обновить место
router.put('/:id', authenticate, berthsController.update.bind(berthsController));

// Удалить место
router.delete('/:id', authenticate, berthsController.delete.bind(berthsController));

export default router;

