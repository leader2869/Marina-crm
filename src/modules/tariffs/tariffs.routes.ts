import { Router } from 'express';
import { TariffsController } from './tariffs.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const tariffsController = new TariffsController();

router.get('/club/:clubId', authenticate, tariffsController.getByClub.bind(tariffsController));
router.post('/', authenticate, tariffsController.create.bind(tariffsController));
router.put('/:id', authenticate, tariffsController.update.bind(tariffsController));
router.delete('/:id', authenticate, tariffsController.delete.bind(tariffsController));

export default router;

