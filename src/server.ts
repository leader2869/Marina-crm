import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { AppDataSource } from './config/database';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './modules/auth/auth.routes';
import clubsRoutes from './modules/clubs/clubs.routes';
import vesselsRoutes from './modules/vessels/vessels.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import financesRoutes from './modules/finances/finances.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import usersRoutes from './modules/users/users.routes';
import berthsRoutes from './modules/berths/berths.routes';
import tariffsRoutes from './modules/tariffs/tariffs.routes';
import bookingRulesRoutes from './modules/booking-rules/booking-rules.routes';

const app: Express = express();

// Инициализация базы данных
let isInitialized = false;
let initializationError: Error | null = null;

const initializeApp = async (): Promise<void> => {
  if (!isInitialized && !initializationError) {
    try {
      await AppDataSource.initialize();
      console.log('✅ База данных подключена');
      isInitialized = true;
    } catch (error: any) {
      console.error('❌ Ошибка при подключении к базе данных:', error);
      initializationError = error;
      // Не блокируем запуск приложения, но логируем ошибку
    }
  }
};

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug logging for Vercel (only in production)
if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[Vercel] ${req.method} ${req.url}`, {
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      query: req.query
    });
    next();
  });
}

// Initialize on first request (for Vercel) - ДО маршрутов!
app.use(async (req: Request, res: Response, next: NextFunction) => {
  try {
    await initializeApp();
    if (initializationError) {
      // Если есть ошибка инициализации, возвращаем 503 вместо 500
      return res.status(503).json({ 
        error: 'Сервис временно недоступен',
        message: 'База данных не подключена',
        details: process.env.NODE_ENV === 'development' ? initializationError.message : undefined
      });
    }
    next();
  } catch (error: any) {
    console.error('❌ Ошибка при инициализации:', error);
    return res.status(503).json({ 
      error: 'Сервис временно недоступен',
      message: error.message
    });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', (req, res, next) => {
  console.log(`[Auth Route] ${req.method} ${req.path}`, { originalUrl: req.originalUrl });
  next();
}, authRoutes);
app.use('/api/clubs', clubsRoutes);
app.use('/api/vessels', vesselsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/berths', berthsRoutes);
app.use('/api/tariffs', tariffsRoutes);
app.use('/api/booking-rules', bookingRulesRoutes);

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Маршрут не найден' });
});

// Export app for Vercel (serverless)
// Для CommonJS также экспортируем напрямую
export default app;
// Для совместимости с CommonJS require
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  module.exports.default = app;
}

// For local development, start server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  const startServer = async (): Promise<void> => {
    try {
      await AppDataSource.initialize();
      console.log('✅ База данных подключена');

      app.listen(config.port, () => {
        console.log(`🚀 Сервер запущен на порту ${config.port}`);
        console.log(`📝 API доступен по адресу http://localhost:${config.port}/api`);
      });
    } catch (error) {
      console.error('❌ Ошибка при запуске сервера:', error);
      process.exit(1);
    }
  };

  startServer();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM получен, закрытие соединений...');
    await AppDataSource.destroy();
    process.exit(0);
  });
}



