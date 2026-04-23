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
import vesselOwnerCashesRoutes from './modules/vessel-owner-cashes/vessel-owner-cashes.routes';
import incomeCategoriesRoutes from './modules/incomes/income-categories.routes';
import expenseCategoriesRoutes from './modules/incomes/expense-categories.routes';
import incomesRoutes from './modules/incomes/incomes.routes';
import agentOrdersRoutes from './modules/agent-orders/agent-orders.routes';
import contractFillingRoutes from './modules/contract-filling/contract-filling.routes';
import clubFinanceRoutes from './modules/club-finance/club-finance.routes';

const app: Express = express();
let dbInitPromise: Promise<void> | null = null;

// Middleware
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'https://www.1marina.ru',
      'https://1marina.ru',
      'http://www.1marina.ru',
      'http://1marina.ru',
      'https://marina-crm.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
    ];
    if (config.frontendUrl && !allowedOrigins.includes(config.frontendUrl)) {
      allowedOrigins.push(config.frontendUrl);
    }

    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS] Заблокирован origin: ${origin}, разрешены: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Authorization'],
  maxAge: 86400, // 24 часа
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Обработка OPTIONS запросов (preflight)
app.options('*', (req: Request, res: Response) => {
  console.log(`[CORS] OPTIONS ${req.url} from origin: ${req.headers.origin}`);
  res.sendStatus(200);
});

// Увеличиваем лимит размера тела запроса для загрузки изображений (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Глобальный предохранитель пагинации: не позволяем тяжелые limit=1000/10000 на проде.
app.use('/api', (req: Request, _res: Response, next: NextFunction) => {
  const limitRaw = req.query.limit;
  if (typeof limitRaw === 'string') {
    const parsedLimit = Number(limitRaw);
    if (Number.isFinite(parsedLimit) && parsedLimit > 100) {
      req.query.limit = '100';
    }
  }
  next();
});

app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health') {
    return next();
  }

  if (AppDataSource.isInitialized) {
    return next();
  }

  try {
    if (!dbInitPromise) {
      dbInitPromise = AppDataSource.initialize().then(() => {
        console.log('✅ База данных подключена (lazy init)');
      });
    }
    await dbInitPromise;
    next();
  } catch (error: any) {
    dbInitPromise = null;
    console.error('❌ Ошибка lazy init базы данных:', error?.message || error);
    return res.status(503).json({
      error: 'Сервис временно недоступен',
      message: 'База данных не подключена',
    });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[API] ${req.method} ${req.url}`, {
      path: req.path,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      query: req.query
    });
    next();
  });
}

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
app.use('/api/vessels', (req, res, next) => {
  console.log(`[Vessels Middleware] ${req.method} ${req.path}`, {
    originalUrl: req.originalUrl,
    url: req.url,
    baseUrl: req.baseUrl,
  });
  next();
}, autoActivityLogger, vesselsRoutes);
app.use('/api/bookings', autoActivityLogger, bookingsRoutes);
app.use('/api/finances', autoActivityLogger, financesRoutes);
app.use('/api/payments', autoActivityLogger, paymentsRoutes);
app.use('/api/users', autoActivityLogger, usersRoutes);
app.use('/api/berths', autoActivityLogger, berthsRoutes);
app.use('/api/tariffs', autoActivityLogger, tariffsRoutes);
app.use('/api/booking-rules', autoActivityLogger, bookingRulesRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/vessel-owner/cashes', autoActivityLogger, vesselOwnerCashesRoutes);
app.use('/api/vessel-owner/income-categories', autoActivityLogger, incomeCategoriesRoutes);
app.use('/api/vessel-owner/expense-categories', autoActivityLogger, expenseCategoriesRoutes);
app.use('/api/vessel-owner/incomes', autoActivityLogger, incomesRoutes);
app.use('/api/agent-orders', (req, res, next) => {
  console.log(`[Server] Agent Orders Route: ${req.method} ${req.path}`, { originalUrl: req.originalUrl });
  next();
}, autoActivityLogger, agentOrdersRoutes);
app.use('/api/contract-filling', autoActivityLogger, contractFillingRoutes);
app.use('/api/club-finance', autoActivityLogger, clubFinanceRoutes);

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

const startServer = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      console.log('✅ База данных подключена');
    }

      // Периодическую проверку запускаем только при явном включении.
      // В production это защищает API от перегрузки БД фоновыми задачами.
      const shouldRunImmediatePaymentCheck = process.env.ENABLE_IMMEDIATE_PAYMENT_CHECK === 'true';
      let checkInterval: NodeJS.Timeout | null = null;
      if (shouldRunImmediatePaymentCheck) {
        const { ImmediatePaymentCheckService } = await import('./services/immediatePaymentCheck.service');
        checkInterval = ImmediatePaymentCheckService.startPeriodicCheck(30);
        console.log('✅ Запущена периодическая проверка просроченных платежей с немедленной оплатой');
      } else {
        console.log('ℹ️ Периодическая проверка просроченных платежей отключена (ENABLE_IMMEDIATE_PAYMENT_CHECK != true)');
      }

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
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      process.exit(0);
    });
  } catch (error) {
    console.error('❌ Ошибка при запуске сервера:', error);
    process.exit(1);
  }
};

if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  startServer();
}



