import { Request, Response, NextFunction } from 'express';
import { ActivityLogService } from '../services/activityLog.service';
import { ActivityType, EntityType } from '../entities/ActivityLog';
import { AuthRequest } from './auth';
import { getEntityTypeFromPath } from './activityLogger';
import { generateActivityDescription } from '../utils/activityLogDescription';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { Club } from '../entities/Club';
import { Vessel } from '../entities/Vessel';
import { Booking } from '../entities/Booking';
import { Berth } from '../entities/Berth';
import { Payment } from '../entities/Payment';
import { Tariff } from '../entities/Tariff';
import { BookingRule } from '../entities/BookingRule';

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
  let oldValues: Record<string, any> | null = null;
  
  // Для UPDATE операций загружаем старые значения перед обновлением
  const method = req.method.toUpperCase();
  if ((method === 'PUT' || method === 'PATCH') && req.params.id) {
    try {
      const entityType = getEntityTypeFromPath(req.path);
      const entityId = parseInt(req.params.id);
      
      if (entityId && entityType !== EntityType.OTHER) {
        let repository: any = null;
        
        switch (entityType) {
          case EntityType.USER:
            repository = AppDataSource.getRepository(User);
            break;
          case EntityType.CLUB:
            repository = AppDataSource.getRepository(Club);
            break;
          case EntityType.VESSEL:
            repository = AppDataSource.getRepository(Vessel);
            break;
          case EntityType.BOOKING:
            repository = AppDataSource.getRepository(Booking);
            break;
          case EntityType.BERTH:
            repository = AppDataSource.getRepository(Berth);
            break;
          case EntityType.PAYMENT:
            repository = AppDataSource.getRepository(Payment);
            break;
          case EntityType.TARIFF:
            repository = AppDataSource.getRepository(Tariff);
            break;
          case EntityType.BOOKING_RULE:
            repository = AppDataSource.getRepository(BookingRule);
            break;
        }
        
        if (repository) {
          const entity = await repository.findOne({ where: { id: entityId } });
          if (entity) {
            // Удаляем служебные поля и связи
            const { password, ...entityData } = entity;
            oldValues = { ...entityData };
            // Удаляем вложенные объекты и функции
            Object.keys(oldValues).forEach(key => {
              if (typeof oldValues[key] === 'object' && oldValues[key] !== null && !Array.isArray(oldValues[key]) && !(oldValues[key] instanceof Date)) {
                if (oldValues[key].constructor.name !== 'Object') {
                  delete oldValues[key];
                }
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки старых значений для логирования:', error);
      // Продолжаем выполнение, даже если не удалось загрузить старые значения
    }
  }
  
  // Переопределяем res.status для перехвата статуса
  res.status = function (code: number) {
    statusCode = code;
    return originalStatus(code);
  };
  
  // Переопределяем res.json для перехвата ответа
  res.json = function (body: any) {
    // Вызываем оригинальный метод
    const result = originalJson(body);
    
    // Логируем только успешные изменения (POST, PUT, PATCH)
    // Для DELETE не логируем автоматически, так как логирование выполняется в контроллерах с детальной информацией
    if (statusCode >= 200 && statusCode < 300) {
      const method = req.method.toUpperCase();
      let activityType: ActivityType | null = null;
      
      // Проверяем, не залогировал ли контроллер действие детально
      // Если в res.locals есть флаг skipAutoLogging, пропускаем автоматическое логирование
      if ((res as any).locals?.skipAutoLogging) {
        return result;
      }

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
          // Не логируем DELETE автоматически - логирование выполняется в контроллерах
          return result;
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
      // Убираем лишние пробелы и email из имени пользователя
      const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
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
      
      // Для UPDATE формируем описание с изменениями, если есть oldValues и newValues
      let description: string;
      let finalOldValues: Record<string, any> | null = null;
      let finalNewValues: Record<string, any> | null = null;
      
      if (activityType === ActivityType.UPDATE && oldValues && body) {
        // Формируем newValues из ответа
        const { password, ...newData } = body;
        finalNewValues = { ...newData };
        // Удаляем вложенные объекты и функции
        Object.keys(finalNewValues).forEach(key => {
          if (typeof finalNewValues[key] === 'object' && finalNewValues[key] !== null && !Array.isArray(finalNewValues[key]) && !(finalNewValues[key] instanceof Date)) {
            if (finalNewValues[key].constructor.name !== 'Object') {
              delete finalNewValues[key];
            }
          }
        });
        
        finalOldValues = oldValues;
        
        // Генерируем описание с изменениями
        description = generateActivityDescription(
          activityType,
          entityType,
          entityId,
          userName,
          entityName,
          finalOldValues,
          finalNewValues
        );
      } else {
        description = generateActivityDescription(
          activityType,
          entityType,
          entityId,
          userName,
          entityName
        );
      }
      
      // Логируем действие (не ждем завершения, чтобы не замедлять ответ)
      ActivityLogService.logActivity({
        activityType,
        entityType,
        entityId,
        userId: req.userId || null,
        description,
        oldValues: finalOldValues,
        newValues: finalNewValues,
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

