import { Router } from 'express';
import { FinancesController } from './finances.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const financesController = new FinancesController();

// Доходы
router.get('/incomes', authenticate, financesController.getIncomes.bind(financesController));
router.post('/incomes', authenticate, financesController.createIncome.bind(financesController));

// Расходы
router.get('/expenses', authenticate, financesController.getExpenses.bind(financesController));
router.post('/expenses', authenticate, financesController.createExpense.bind(financesController));
router.post('/expenses/:id/approve', authenticate, financesController.approveExpense.bind(financesController));

// Категории расходов
router.get('/expense-categories', authenticate, financesController.getExpenseCategories.bind(financesController));
router.post('/expense-categories', authenticate, financesController.createExpenseCategory.bind(financesController));

// Аналитика
router.get('/analytics', authenticate, financesController.getFinancialAnalytics.bind(financesController));

// Бюджет
router.get('/budgets', authenticate, financesController.getBudgets.bind(financesController));
router.post('/budgets', authenticate, financesController.createBudget.bind(financesController));

export default router;


