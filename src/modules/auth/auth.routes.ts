import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const authController = new AuthController();

// Логирование всех запросов к auth роутеру
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[Auth Router] ${req.method} ${req.path}`, {
    originalUrl: req.originalUrl,
    baseUrl: req.baseUrl,
    url: req.url
  });
  next();
});

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/guest', authController.loginAsGuest.bind(authController));
router.get('/profile', authenticate, authController.getProfile.bind(authController));

// Обработка несуществующих маршрутов
router.all('*', (req: Request, res: Response) => {
  console.log(`[Auth Router] 404: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Маршрут не найден в auth роутере' });
});

export default router;



