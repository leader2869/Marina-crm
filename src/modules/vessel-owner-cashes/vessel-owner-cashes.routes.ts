import { Router } from 'express';
import { VesselOwnerCashesController } from './vessel-owner-cashes.controller';
import { CashTransactionsController } from './cash-transactions.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const cashesController = new VesselOwnerCashesController();
const transactionsController = new CashTransactionsController();

// Роуты для касс
// ВАЖНО: Специфичные роуты должны быть ДО общих роутов с параметрами
router.get('/', authenticate, cashesController.getAll.bind(cashesController));
router.post('/', authenticate, cashesController.create.bind(cashesController));

// Роуты для транзакций кассы (ДО /:id, чтобы не конфликтовали)
router.get(
  '/:cashId/transactions',
  authenticate,
  transactionsController.getAll.bind(transactionsController)
);
router.get(
  '/:cashId/transactions/:id',
  authenticate,
  transactionsController.getById.bind(transactionsController)
);
router.post(
  '/:cashId/transactions',
  authenticate,
  transactionsController.create.bind(transactionsController)
);
router.put(
  '/:cashId/transactions/:id',
  authenticate,
  transactionsController.update.bind(transactionsController)
);
router.delete(
  '/:cashId/transactions/:id',
  authenticate,
  transactionsController.delete.bind(transactionsController)
);

// Роуты для касс с параметрами (ПОСЛЕ роутов транзакций)
router.get('/total-income', authenticate, cashesController.getTotalIncome.bind(cashesController));
router.get('/total-expense', authenticate, cashesController.getTotalExpense.bind(cashesController));
router.get('/:id/balance', authenticate, cashesController.getBalance.bind(cashesController));
router.get('/:id', authenticate, cashesController.getById.bind(cashesController));
router.put('/:id', authenticate, cashesController.update.bind(cashesController));
router.delete('/:id', authenticate, cashesController.delete.bind(cashesController));

export default router;

