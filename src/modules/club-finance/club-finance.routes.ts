import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { ClubFinanceController } from './club-finance.controller';

const router = Router();
const controller = new ClubFinanceController();

router.get('/clubs/:clubId/partners', authenticate, controller.getPartners.bind(controller));
router.post('/clubs/:clubId/partners', authenticate, controller.createPartner.bind(controller));
router.put('/clubs/:clubId/partners/:partnerId', authenticate, controller.updatePartner.bind(controller));
router.delete('/clubs/:clubId/partners/:partnerId', authenticate, controller.deletePartner.bind(controller));

router.get('/clubs/:clubId/cash-transactions', authenticate, controller.getCashTransactions.bind(controller));
router.post('/clubs/:clubId/cash-transactions', authenticate, controller.createCashTransaction.bind(controller));
router.put('/clubs/:clubId/cash-transactions/:transactionId', authenticate, controller.updateCashTransaction.bind(controller));
router.delete('/clubs/:clubId/cash-transactions/:transactionId', authenticate, controller.deleteCashTransaction.bind(controller));

router.get('/clubs/:clubId/settlements', authenticate, controller.getSettlements.bind(controller));

export default router;

