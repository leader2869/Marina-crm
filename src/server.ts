import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { AppDataSource } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { autoActivityLogger } from './middleware/autoActivityLogger';

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
import activityLogsRoutes from './modules/activity-logs/activity-logs.routes';

const app: Express = express();

// Инициализация базы данных
let isInitialized = false;
let initializationError: Error | null = null;

const initializeApp = async (): Promise<void> => {
  // Проверяем, не инициализирована ли уже БД
  if (AppDataSource.isInitialized) {
    console.log('✅ База данных уже подключена');
    isInitialized = true;
    return;
  }
  
  if (!isInitialized && !initializationError) {
    try {
      await AppDataSource.initialize();
      console.log('✅ База данных подключена');
      isInitialized = true;
    } catch (error: any) {
      // Проверяем, не связана ли ошибка с тем, что БД уже подключена
      if (error.message && error.message.includes('already established')) {
        console.log('✅ База данных уже подключена (обнаружено существующее соединение)');
        isInitialized = true;
        return;
      }
      console.error('❌ Ошибка при подключении к базе данных:', error);
      initializationError = error;
      // Не блокируем запуск приложения, но логируем ошибку
    }
  }
};

// Middleware
// CORS с поддержкой preflight запросов
// Разрешаем все источники в development, или указанный в production
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // В development разрешаем все источники
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      callback(null, true);
      return;
    }
    
    // На Vercel фронтенд и бэкенд на одном домене, поэтому разрешаем все origin
    if (process.env.VERCEL) {
      callback(null, true);
      return;
    }
    
    // В production разрешаем указанный frontend URL или все (если не указан)
    const allowedOrigins = config.frontendUrl 
      ? [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000']
      : ['*'];
    
    // Разрешаем запросы без origin (same-origin requests) или из списка разрешенных
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Заблокирован origin: ${origin}, разрешены: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400, // 24 часа
};

app.use(cors(corsOptions));

// Обработка OPTIONS запросов (preflight)
app.options('*', (req: Request, res: Response) => {
  console.log(`[CORS] OPTIONS ${req.url} from origin: ${req.headers.origin}`);
  res.sendStatus(200);
});

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
  console.log(`[DB Init] ${req.method} ${req.url} - инициализация БД`);
  
  // Проверяем наличие переменных окружения
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasDbConfig = !!(process.env.DB_HOST && process.env.DB_PASSWORD);
  
  if (!hasDatabaseUrl && !hasDbConfig) {
    console.error(`[DB Init] ❌ Переменные окружения не настроены!`);
    console.error(`[DB Init] Нужно установить DATABASE_URL или DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD`);
    return res.status(503).json({ 
      error: 'Сервис временно недоступен',
      message: 'База данных не настроена',
      details: 'Проверьте переменные окружения в Vercel Dashboard. См. VERCEL_DATABASE_SETUP.md'
    });
  }
  
  try {
    await initializeApp();
    if (initializationError) {
      console.error(`[DB Init] ❌ Ошибка инициализации БД:`, initializationError.message);
      console.error(`[DB Init] Проверьте: 1) Переменные окружения, 2) Connection string, 3) Пароль, 4) Статус проекта Supabase`);
      // Если есть ошибка инициализации, возвращаем 503 вместо 500
      return res.status(503).json({ 
        error: 'Сервис временно недоступен',
        message: 'База данных не подключена',
        details: process.env.NODE_ENV === 'development' ? initializationError.message : 'Проверьте логи в Vercel Dashboard. См. VERCEL_DATABASE_SETUP.md'
      });
    }
    console.log(`[DB Init] ✅ БД инициализирована, продолжаем запрос`);
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
// Применяем автоматическое логирование ко всем API роутам (кроме auth и activity-logs)
app.use('/api/clubs', autoActivityLogger, clubsRoutes);
app.use('/api/vessels', autoActivityLogger, vesselsRoutes);
app.use('/api/bookings', autoActivityLogger, bookingsRoutes);
app.use('/api/finances', autoActivityLogger, financesRoutes);
app.use('/api/payments', autoActivityLogger, paymentsRoutes);
app.use('/api/users', autoActivityLogger, usersRoutes);
app.use('/api/berths', autoActivityLogger, berthsRoutes);
app.use('/api/tariffs', autoActivityLogger, tariffsRoutes);
app.use('/api/booking-rules', autoActivityLogger, bookingRulesRoutes);
app.use('/api/activity-logs', activityLogsRoutes);

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

      // Запускаем периодическую проверку просроченных платежей с немедленной оплатой
      const { ImmediatePaymentCheckService } = await import('./services/immediatePaymentCheck.service');
      let checkInterval: NodeJS.Timeout | null = null;
      
      // Запускаем проверку каждые 30 секунд
      checkInterval = ImmediatePaymentCheckService.startPeriodicCheck(30);
      console.log('✅ Запущена периодическая проверка просроченных платежей с немедленной оплатой');

      app.listen(config.port, () => {
        console.log(`🚀 Сервер запущен на порту ${config.port}`);
        console.log(`📝 API доступен по адресу http://localhost:${config.port}/api`);
      });

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        console.log('SIGTERM получен, закрытие соединений...');
        if (checkInterval) {
          clearInterval(checkInterval);
        }
        await AppDataSource.destroy();
        process.exit(0);
      });
    } catch (error) {
      console.error('❌ Ошибка при запуске сервера:', error);
      process.exit(1);
    }
  };

  startServer();
}



