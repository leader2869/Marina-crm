import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activityLog.service';
import { ActivityType, EntityType } from '../entities/ActivityLog';
import { AuthRequest } from './auth';
import { getEntityTypeFromPath } from './activityLogger';
import { generateActivityDescription } from '../utils/activityLogDescription';

/**
 * Универсальный middleware для автоматического логирования всех изменений
 */
export const autoActivityLogger = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Сохраняем оригинальный метод res.json
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  
  let statusCode = 200;
  
  // Переопределяем res.status для перехвата статуса
  res.status = function (code: number) {
    statusCode = code;
    return originalStatus(code);
  };
  
  // Переопределяем res.json для перехвата ответа
  res.json = function (body: any) {
    // Вызываем оригинальный метод
    const result = originalJson(body);
    
    // Логируем только успешные изменения (POST, PUT, PATCH, DELETE)
    if (statusCode >= 200 && statusCode < 300) {
      const method = req.method.toUpperCase();
      let activityType: ActivityType | null = null;
      
      // Определяем тип активности по методу
      switch (method) {
        case 'POST':
          activityType = ActivityType.CREATE;
          break;
        case 'PUT':
        case 'PATCH':
          activityType = ActivityType.UPDATE;
          break;
        case 'DELETE':
          activityType = ActivityType.DELETE;
          break;
        default:
          // Для GET и других методов не логируем
          return result;
      }
      
      // Определяем тип сущности по пути
      const entityType = getEntityTypeFromPath(req.path);
      
      // Получаем ID сущности из параметров или тела запроса
      let entityId: number | null = null;
      if (req.params.id) {
        entityId = parseInt(req.params.id);
      } else if (req.params.clubId) {
        entityId = parseInt(req.params.clubId);
      } else if (req.params.vesselId) {
        entityId = parseInt(req.params.vesselId);
      } else if (req.params.bookingId) {
        entityId = parseInt(req.params.bookingId);
      } else if (body?.id) {
        entityId = parseInt(body.id);
      } else if (body?.user?.id) {
        entityId = parseInt(body.user.id);
      } else if (body?.club?.id) {
        entityId = parseInt(body.club.id);
      } else if (body?.vessel?.id) {
        entityId = parseInt(body.vessel.id);
      }
      
      // Формируем понятное описание на русском языке
      const userName = req.user ? `${req.user.firstName} ${req.user.lastName}` : null;
      let entityName: string | null = null;
      
      // Пытаемся получить название сущности из ответа
      if (body?.name) {
        entityName = body.name;
      } else if (body?.user?.firstName && body?.user?.lastName) {
        entityName = `${body.user.firstName} ${body.user.lastName}`;
      } else if (body?.club?.name) {
        entityName = body.club.name;
      } else if (body?.vessel?.name) {
        entityName = body.vessel.name;
      }
      
      const description = generateActivityDescription(
        activityType,
        entityType,
        entityId,
        userName,
        entityName
      );
      
      // Логируем действие (не ждем завершения, чтобы не замедлять ответ)
      // Не сохраняем oldValues и newValues, так как описание уже содержит всю необходимую информацию
      ActivityLogService.logActivity({
        activityType,
        entityType,
        entityId,
        userId: req.userId || null,
        description,
        oldValues: null, // Не сохраняем JSON, только понятное описание
        newValues: null, // Не сохраняем JSON, только понятное описание
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
      }).catch((error) => {
        console.error('Ошибка логирования активности:', error);
      });
    }
    
    return result;
  };
  
  next();
};

