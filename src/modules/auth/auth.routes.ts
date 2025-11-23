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
    url: req.url,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Основные роуты
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/guest', authController.loginAsGuest.bind(authController));
router.get('/profile', authenticate, authController.getProfile.bind(authController));
router.put('/profile', authenticate, authController.updateProfile.bind(authController));
router.post('/change-password', authenticate, authController.changePassword.bind(authController));
router.post('/request-phone-change', authenticate, authController.requestPhoneChange.bind(authController));

// Информационные GET endpoints для документации (должны быть после основных роутов)
router.get('/login', (req: Request, res: Response) => {
  res.status(405).json({
    error: 'Метод не разрешен',
    message: 'Используйте POST метод для входа',
    method: 'POST',
    endpoint: '/api/auth/login',
    example: {
      method: 'POST',
      url: '/api/auth/login',
      body: {
        emailOrPhone: 'user@example.com',
        password: 'password123'
      }
    }
  });
});

router.get('/register', (req: Request, res: Response) => {
  res.status(405).json({
    error: 'Метод не разрешен',
    message: 'Используйте POST метод для регистрации',
    method: 'POST',
    endpoint: '/api/auth/register'
  });
});

// Обработка несуществующих маршрутов
router.all('*', (req: Request, res: Response) => {
  console.log(`[Auth Router] 404: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Маршрут не найден в auth роутере',
    availableRoutes: [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'POST /api/auth/guest',
      'GET /api/auth/profile',
      'PUT /api/auth/profile',
      'POST /api/auth/change-password',
      'POST /api/auth/request-phone-change'
    ]
  });
});

export default router;



