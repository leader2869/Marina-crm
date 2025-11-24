import { Router } from 'express';
import { AgentOrdersController } from './agent-orders.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const agentOrdersController = new AgentOrdersController();

// Логирование для отладки
router.use((req, res, next) => {
  console.log(`[Agent Orders Route] ${req.method} ${req.path}`, { originalUrl: req.originalUrl });
  next();
});

router.get('/', authenticate, agentOrdersController.getAll.bind(agentOrdersController));
router.post('/', authenticate, agentOrdersController.create.bind(agentOrdersController));
router.post('/:orderId/respond', authenticate, agentOrdersController.respond.bind(agentOrdersController));
router.post('/:orderId/select-vessel', authenticate, agentOrdersController.selectVessel.bind(agentOrdersController));
router.get('/:id', authenticate, agentOrdersController.getById.bind(agentOrdersController));

export default router;

