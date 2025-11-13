import { AppDataSource } from '../config/database';
import { ActivityLog, ActivityType, EntityType } from '../entities/ActivityLog';

interface LogActivityParams {
  activityType: ActivityType;
  entityType: EntityType;
  entityId?: number | null;
  userId?: number | null;
  description?: string | null;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export class ActivityLogService {
  /**
   * Записывает действие пользователя в лог
   */
  static async logActivity(params: LogActivityParams): Promise<void> {
    try {
      const activityLogRepository = AppDataSource.getRepository(ActivityLog);
      
      const log = activityLogRepository.create({
        activityType: params.activityType,
        entityType: params.entityType,
        entityId: params.entityId || null,
        userId: params.userId || null,
        description: params.description || null,
        oldValues: params.oldValues || null,
        newValues: params.newValues || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      });

      await activityLogRepository.save(log);
    } catch (error) {
      // Не прерываем выполнение, если логирование не удалось
      console.error('Ошибка записи в лог активности:', error);
    }
  }

  /**
   * Получает логи активности с пагинацией
   */
  static async getLogs(params: {
    page?: number;
    limit?: number;
    userId?: number;
    entityType?: EntityType;
    activityType?: ActivityType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const activityLogRepository = AppDataSource.getRepository(ActivityLog);
    
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user')
      .orderBy('log.createdAt', 'DESC');

    if (params.userId) {
      queryBuilder.andWhere('log.userId = :userId', { userId: params.userId });
    }

    if (params.entityType) {
      queryBuilder.andWhere('log.entityType = :entityType', { entityType: params.entityType });
    }

    if (params.activityType) {
      queryBuilder.andWhere('log.activityType = :activityType', { activityType: params.activityType });
    }

    if (params.startDate) {
      queryBuilder.andWhere('log.createdAt >= :startDate', { startDate: params.startDate });
    }

    if (params.endDate) {
      queryBuilder.andWhere('log.createdAt <= :endDate', { endDate: params.endDate });
    }

    const [logs, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

