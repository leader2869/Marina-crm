import { Router } from 'express';
import { AgentOrdersController } from './agent-orders.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const agentOrdersController = new AgentOrdersController();

router.get('/', authenticate, agentOrdersController.getAll.bind(agentOrdersController));
router.post('/', authenticate, agentOrdersController.create.bind(agentOrdersController));
router.get('/:id', authenticate, agentOrdersController.getById.bind(agentOrdersController));
router.post('/:orderId/respond', authenticate, agentOrdersController.respond.bind(agentOrdersController));
router.post('/:orderId/select-vessel', authenticate, agentOrdersController.selectVessel.bind(agentOrdersController));

export default router;

