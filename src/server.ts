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
      console.log('[DB Init] Начинаем инициализацию БД...');
      console.log('[DB Init] DATABASE_URL:', process.env.DATABASE_URL ? '✅ установлен' : '❌ отсутствует');
      console.log('[DB Init] DB_HOST:', process.env.DB_HOST || 'не установлен');
      console.log('[DB Init] DB_NAME:', process.env.DB_NAME || 'не установлен');
      console.log('[DB Init] DB_USER:', process.env.DB_USER || 'не установлен');
      console.log('[DB Init] DB_PASSWORD:', process.env.DB_PASSWORD ? '✅ установлен' : '❌ отсутствует');
      
      // Добавляем таймаут для инициализации (30 секунд)
      const initPromise = AppDataSource.initialize();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Таймаут инициализации БД (30 секунд)')), 30000);
      });
      
      await Promise.race([initPromise, timeoutPromise]);
      
      console.log('✅ База данных подключена');
      
      // Проверяем, что все entities загружены правильно
      try {
        const entityMetadatas = AppDataSource.entityMetadatas;
        console.log(`[DB Init] Загружено entities: ${entityMetadatas.length}`);
        
        // Проверяем, что Contragent entity загружена
        const contragentMetadata = entityMetadatas.find(m => m.name === 'Contragent');
        if (contragentMetadata) {
          console.log('[DB Init] Entity Contragent загружена успешно');
        }
      } catch (metadataError: any) {
        console.warn('[DB Init] Предупреждение при проверке metadata:', metadataError.message);
      }
      
      isInitialized = true;
      initializationError = null;
    } catch (error: any) {
      // Проверяем, не связана ли ошибка с тем, что БД уже подключена
      if (error.message && error.message.includes('already established')) {
        console.log('✅ База данных уже подключена (обнаружено существующее соединение)');
        isInitialized = true;
        initializationError = null;
        return;
      }
      
      // Проверяем, не связана ли ошибка с entity Contragent
      if (error.message && (error.message.includes('contragents') || error.message.includes('Contragent') || error.message.includes('user_id') || error.message.includes('club_id'))) {
        console.error('❌ Ошибка связана с entity Contragent:', error.message);
        console.error('❌ Stack:', error.stack);
        console.error('💡 Возможно, таблица contragents имеет неправильную структуру');
        console.error('💡 Запустите: npm run create-contragents-table');
        console.error('💡 Или проверьте, что таблица существует и имеет правильную структуру');
        
        // Если ошибка связана с Contragent, пробуем инициализировать без неё
        console.log('🔄 Пробуем инициализировать БД без entity Contragent...');
        try {
          // Временно исключаем Contragent из entities
          const tempDataSource = new DataSource({
            ...AppDataSource.options,
            entities: AppDataSource.options.entities?.filter((e: any) => e.name !== 'Contragent') || []
          });
          await tempDataSource.initialize();
          console.log('✅ БД инициализирована без Contragent');
          // Используем временный DataSource для основных операций
          // Но это не идеальное решение, лучше исправить структуру таблицы
        } catch (tempError: any) {
          console.error('❌ Не удалось инициализировать БД даже без Contragent:', tempError.message);
        }
      }
      
      console.error('❌ Ошибка при подключении к базе данных:', error.message);
      console.error('❌ Stack:', error.stack);
      console.error('❌ Code:', error.code);
      console.error('❌ Detail:', error.detail);
      console.error('❌ Name:', error.name);
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

// Увеличиваем лимит размера тела запроса для загрузки изображений (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
  // Пропускаем health check без инициализации БД
  if (req.path === '/health') {
    return next();
  }
  
  console.log(`[DB Init] ${req.method} ${req.url} - инициализация БД`);
  
  // Проверяем наличие переменных окружения
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const hasDbConfig = !!(process.env.DB_HOST && process.env.DB_PASSWORD);
  
  if (!hasDatabaseUrl && !hasDbConfig) {
    console.error(`[DB Init] ❌ Переменные окружения не настроены!`);
    console.error(`[DB Init] DATABASE_URL: ${hasDatabaseUrl ? '✅ установлен' : '❌ отсутствует'}`);
    console.error(`[DB Init] DB_HOST: ${process.env.DB_HOST ? '✅ установлен' : '❌ отсутствует'}`);
    console.error(`[DB Init] DB_PASSWORD: ${process.env.DB_PASSWORD ? '✅ установлен' : '❌ отсутствует'}`);
    console.error(`[DB Init] Нужно установить DATABASE_URL или DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD`);
    return res.status(503).json({ 
      error: 'Сервис временно недоступен',
      message: 'База данных не настроена',
      details: 'Проверьте переменные окружения в Vercel Dashboard. См. VERCEL_DATABASE_SETUP.md'
    });
  }
  
  try {
    // Сбрасываем ошибку перед новой попыткой инициализации
    if (AppDataSource.isInitialized) {
      console.log(`[DB Init] ✅ БД уже инициализирована`);
      return next();
    }
    
    // Если была ошибка, но БД не инициализирована, сбрасываем ошибку и пробуем снова
    if (initializationError && !AppDataSource.isInitialized) {
      console.log(`[DB Init] 🔄 Повторная попытка инициализации после ошибки`);
      initializationError = null;
      isInitialized = false;
    }
    
    await initializeApp();
    
    if (initializationError) {
      console.error(`[DB Init] ❌ Ошибка инициализации БД:`, initializationError.message);
      console.error(`[DB Init] Stack:`, initializationError.stack);
      console.error(`[DB Init] Проверьте: 1) Переменные окружения, 2) Connection string, 3) Пароль, 4) Статус проекта Supabase`);
      // Если есть ошибка инициализации, возвращаем 503 вместо 500
      return res.status(503).json({ 
        error: 'Сервис временно недоступен',
        message: 'База данных не подключена',
        details: process.env.NODE_ENV === 'development' ? initializationError.message : 'Проверьте логи в Vercel Dashboard. См. VERCEL_DATABASE_SETUP.md'
      });
    }
    
    if (!AppDataSource.isInitialized) {
      console.error(`[DB Init] ❌ БД не инициализирована после вызова initializeApp()`);
      return res.status(503).json({ 
        error: 'Сервис временно недоступен',
        message: 'База данных не подключена',
        details: 'Ошибка инициализации базы данных. Проверьте логи.'
      });
    }
    
    console.log(`[DB Init] ✅ БД инициализирована, продолжаем запрос`);
    next();
  } catch (error: any) {
    console.error('❌ Ошибка при инициализации:', error);
    console.error('❌ Stack:', error.stack);
    initializationError = error;
    return res.status(503).json({ 
      error: 'Сервис временно недоступен',
      message: error.message || 'Ошибка подключения к базе данных',
      details: process.env.NODE_ENV === 'development' ? error.stack : 'Проверьте логи в Vercel Dashboard'
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



