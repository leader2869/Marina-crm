import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activityLog.service';
import { ActivityType, EntityType } from '../entities/ActivityLog';
import { AuthRequest } from './auth';

/**
 * Middleware для автоматического логирования действий пользователей
 */
export const activityLogger = (options: {
  entityType: EntityType;
  getEntityId?: (req: AuthRequest) => number | null;
  getDescription?: (req: AuthRequest) => string | null;
  getOldValues?: (req: AuthRequest) => Record<string, any> | null;
  getNewValues?: (req: AuthRequest) => Record<string, any> | null;
  activityType?: ActivityType;
}) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    // Сохраняем оригинальный метод res.json
    const originalJson = res.json.bind(res);
    
    // Переопределяем res.json для перехвата ответа
    res.json = function (body: any) {
      // Вызываем оригинальный метод
      const result = originalJson(body);
      
      // Логируем действие после успешного ответа
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const activityType = options.activityType || getActivityTypeFromMethod(req.method);
        
        ActivityLogService.logActivity({
          activityType,
          entityType: options.entityType,
          entityId: options.getEntityId ? options.getEntityId(req) : null,
          userId: req.userId || null,
          description: options.getDescription ? options.getDescription(req) : null,
          oldValues: options.getOldValues ? options.getOldValues(req) : null,
          newValues: options.getNewValues ? options.getNewValues(req) : null,
          ipAddress: req.ip || req.headers['x-forwarded-for'] as string || null,
          userAgent: req.headers['user-agent'] || null,
        }).catch((error) => {
          console.error('Ошибка логирования активности:', error);
        });
      }
      
      return result;
    };
    
    next();
  };
};

/**
 * Определяет тип активности по HTTP методу
 */
function getActivityTypeFromMethod(method: string): ActivityType {
  switch (method.toUpperCase()) {
    case 'POST':
      return ActivityType.CREATE;
    case 'PUT':
    case 'PATCH':
      return ActivityType.UPDATE;
    case 'DELETE':
      return ActivityType.DELETE;
    case 'GET':
      return ActivityType.VIEW;
    default:
      return ActivityType.OTHER;
  }
}

/**
 * Получает тип сущности из пути запроса
 */
export function getEntityTypeFromPath(path: string): EntityType {
  if (path.includes('/users')) return EntityType.USER;
  if (path.includes('/clubs')) return EntityType.CLUB;
  if (path.includes('/vessels')) return EntityType.VESSEL;
  if (path.includes('/bookings')) return EntityType.BOOKING;
  if (path.includes('/berths')) return EntityType.BERTH;
  if (path.includes('/payments')) return EntityType.PAYMENT;
  if (path.includes('/tariffs')) return EntityType.TARIFF;
  if (path.includes('/booking-rules')) return EntityType.BOOKING_RULE;
  return EntityType.OTHER;
}

