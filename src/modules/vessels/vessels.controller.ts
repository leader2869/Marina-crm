import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Vessel } from '../../entities/Vessel';
import { User } from '../../entities/User';
import { Booking } from '../../entities/Booking';
import { Payment } from '../../entities/Payment';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { ActivityLogService } from '../../services/activityLog.service';
import { ActivityType, EntityType } from '../../entities/ActivityLog';
import { generateActivityDescription } from '../../utils/activityLogDescription';
import { BookingStatus } from '../../types';
import { In } from 'typeorm';

export class VesselsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const queryBuilder = vesselRepository
        .createQueryBuilder('vessel')
        .leftJoinAndSelect('vessel.owner', 'owner');

      // Если не суперадмин или админ, показываем только свои суда
      if (req.userId && req.userRole !== 'super_admin' && req.userRole !== 'admin') {
        queryBuilder.where('vessel.ownerId = :ownerId', { ownerId: req.userId });
      }

      const [vessels, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      // Преобразуем JSON строки в массивы для фотографий
      const vesselsWithPhotos = vessels.map((vessel: any) => {
        if (vessel.photos) {
          try {
            vessel.photos = JSON.parse(vessel.photos);
          } catch (e) {
            vessel.photos = [];
          }
        } else {
          vessel.photos = [];
        }
        return vessel;
      });

      res.json(createPaginatedResponse(vesselsWithPhotos, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'bookings'],
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      // Преобразуем JSON строку в массив для фотографий
      if (vessel.photos) {
        try {
          (vessel as any).photos = JSON.parse(vessel.photos);
        } catch (e) {
          (vessel as any).photos = [];
        }
      } else {
        (vessel as any).photos = [];
      }

      res.json(vessel);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const {
        name,
        type,
        length,
        width,
        heightAboveWaterline,
        registrationNumber,
        documentPath,
        technicalSpecs,
        photos,
        mainPhotoIndex,
      } = req.body;

      if (!name || !type || !length || !width) {
        throw new AppError('Все обязательные поля должны быть заполнены (название, тип, длина, ширина)', 400);
      }

      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const vesselRepository = AppDataSource.getRepository(Vessel);
      
      // Преобразуем массив фотографий в JSON строку
      let photosJson: string | undefined = undefined;
      if (photos && Array.isArray(photos)) {
        photosJson = JSON.stringify(photos);
      }
      
      const vessel = vesselRepository.create({
        name: name as string,
        type: type as string,
        length: parseFloat(length as string),
        width: parseFloat(width as string),
        heightAboveWaterline: heightAboveWaterline ? parseFloat(heightAboveWaterline as string) : undefined,
        registrationNumber: registrationNumber as string | undefined,
        documentPath: documentPath as string | undefined,
        technicalSpecs: technicalSpecs ? JSON.stringify(technicalSpecs) : undefined,
        photos: photosJson,
        mainPhotoIndex: mainPhotoIndex !== undefined ? parseInt(mainPhotoIndex as string) : undefined,
        ownerId: req.userId,
      });

      await vesselRepository.save(vessel);

      const savedVessel = await vesselRepository.findOne({
        where: { id: vessel.id },
        relations: ['owner'],
      });

      res.status(201).json(savedVessel);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin' &&
        req.userRole !== 'admin'
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      // Обработка изменения владельца (только для супер администратора)
      if (req.body.ownerId !== undefined) {
        if (req.userRole !== 'super_admin') {
          throw new AppError('Только супер администратор может изменять владельца судна', 403);
        }

        const userRepository = AppDataSource.getRepository(User);
        const newOwner = await userRepository.findOne({
          where: { id: parseInt(req.body.ownerId as string) },
        });

        if (!newOwner) {
          throw new AppError('Новый владелец не найден', 404);
        }

        if (!newOwner.isActive) {
          throw new AppError('Новый владелец неактивен', 400);
        }

        vessel.ownerId = newOwner.id;
      }

      // Обновление остальных полей (исключая ownerId, который обработан выше)
      const { ownerId, technicalSpecs, ...otherFields } = req.body;
      
      // Проверка обязательных полей
      if (otherFields.name !== undefined && !otherFields.name) {
        throw new AppError('Название судна обязательно', 400);
      }
      if (otherFields.type !== undefined && !otherFields.type) {
        throw new AppError('Тип судна обязателен', 400);
      }
      if (otherFields.length !== undefined && !otherFields.length) {
        throw new AppError('Длина судна обязательна', 400);
      }
      if (otherFields.width !== undefined && (otherFields.width === null || otherFields.width === '' || otherFields.width === undefined)) {
        throw new AppError('Ширина судна обязательна', 400);
      }
      
      // Проверка: если судно скрыто, то оно не может быть опубликовано
      if (vessel.isActive === false) {
        // Если судно скрыто, сбрасываем статус публикации
        if (otherFields.isValidated !== undefined && otherFields.isValidated === true) {
          throw new AppError('Скрытое судно не может быть опубликовано. Сначала восстановите судно.', 400);
        }
        if (otherFields.isSubmittedForValidation !== undefined && otherFields.isSubmittedForValidation === true) {
          throw new AppError('Скрытое судно не может быть отправлено на валидацию. Сначала восстановите судно.', 400);
        }
        // Если судно скрыто, автоматически сбрасываем статус публикации
        vessel.isValidated = false;
        vessel.isSubmittedForValidation = false;
      }
      
      // Если судно скрывается (isActive становится false), сбрасываем статус публикации
      if (otherFields.isActive !== undefined && otherFields.isActive === false && vessel.isActive === true) {
        vessel.isValidated = false;
        vessel.isSubmittedForValidation = false;
      }
      
      // Сохраняем старые значения для логирования
      const oldValues = {
        name: vessel.name,
        type: vessel.type,
        length: vessel.length,
        width: vessel.width,
        heightAboveWaterline: vessel.heightAboveWaterline,
        registrationNumber: vessel.registrationNumber,
        technicalSpecs: vessel.technicalSpecs,
        isActive: vessel.isActive,
        isValidated: vessel.isValidated,
        isSubmittedForValidation: vessel.isSubmittedForValidation,
        ownerId: vessel.ownerId,
      };

      // Парсим числовые поля
      if (otherFields.length !== undefined) {
        otherFields.length = parseFloat(otherFields.length as string);
      }
      if (otherFields.width !== undefined) {
        otherFields.width = parseFloat(otherFields.width as string);
      }
      if (otherFields.heightAboveWaterline !== undefined && otherFields.heightAboveWaterline !== null && otherFields.heightAboveWaterline !== '') {
        otherFields.heightAboveWaterline = parseFloat(otherFields.heightAboveWaterline as string);
      }
      
      Object.assign(vessel, otherFields);

      if (req.body.technicalSpecs) {
        vessel.technicalSpecs = JSON.stringify(req.body.technicalSpecs);
      }

      // Обработка фотографий
      if (req.body.photos !== undefined) {
        if (Array.isArray(req.body.photos)) {
          vessel.photos = JSON.stringify(req.body.photos);
        } else if (req.body.photos === null) {
          vessel.photos = null;
        }
      }

      // Обработка главного фото
      if (req.body.mainPhotoIndex !== undefined) {
        vessel.mainPhotoIndex = req.body.mainPhotoIndex !== null ? parseInt(req.body.mainPhotoIndex as string) : null;
      }

      await vesselRepository.save(vessel);

      const updatedVessel = await vesselRepository.findOne({
        where: { id: vessel.id },
        relations: ['owner'],
      });

      // Преобразуем JSON строку в массив для фотографий
      if (updatedVessel?.photos) {
        try {
          (updatedVessel as any).photos = JSON.parse(updatedVessel.photos);
        } catch (e) {
          (updatedVessel as any).photos = [];
        }
      } else if (updatedVessel) {
        (updatedVessel as any).photos = [];
      }

      // Формируем новые значения для логирования
      const newValues = {
        name: updatedVessel!.name,
        type: updatedVessel!.type,
        length: updatedVessel!.length,
        width: updatedVessel!.width,
        heightAboveWaterline: updatedVessel!.heightAboveWaterline,
        registrationNumber: updatedVessel!.registrationNumber,
        technicalSpecs: updatedVessel!.technicalSpecs,
        isActive: updatedVessel!.isActive,
        isValidated: updatedVessel!.isValidated,
        isSubmittedForValidation: updatedVessel!.isSubmittedForValidation,
        ownerId: updatedVessel!.ownerId,
      };

      // Логируем обновление с детальным описанием изменений
      const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
      const description = generateActivityDescription(
        ActivityType.UPDATE,
        EntityType.VESSEL,
        vessel.id,
        userName,
        updatedVessel!.name,
        oldValues,
        newValues
      );

      await ActivityLogService.logActivity({
        activityType: ActivityType.UPDATE,
        entityType: EntityType.VESSEL,
        entityId: vessel.id,
        userId: req.userId || null,
        description,
        oldValues,
        newValues,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
      });

      // Помечаем, что детальное логирование уже выполнено, чтобы избежать дублирования
      (res as any).locals = { ...(res as any).locals, skipAutoLogging: true };

      res.json(updatedVessel);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const vesselRepository = AppDataSource.getRepository(Vessel);
    const bookingRepository = AppDataSource.getRepository(Booking);
    let vessel: Vessel | null = null;
    let alreadyLogged = false; // Флаг, чтобы не логировать дважды

    try {
      const { id } = req.params;

      vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner'],
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа - только владелец или супер-администратор
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin'
      ) {
        throw new AppError('Недостаточно прав для удаления', 403);
      }

      // Проверяем наличие связанных броней
      // Сначала получаем все брони для этого катера
      const allBookings = await bookingRepository.find({
        where: { vesselId: vessel.id },
        select: ['id', 'status'],
      });

      console.log(`[Vessel Delete] Всего броней для судна ${vessel.id}: ${allBookings.length}`);

      // Разделяем на отмененные и активные
      const cancelledBookings = allBookings.filter(b => b.status === BookingStatus.CANCELLED);
      const activeBookings = allBookings.filter(b => b.status !== BookingStatus.CANCELLED);

      console.log(`[Vessel Delete] Отмененных броней: ${cancelledBookings.length}, активных: ${activeBookings.length}`);

      // Если есть активные брони - не удаляем катер
      if (activeBookings.length > 0) {
        const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
        const vesselName = vessel.name || 'неизвестное судно';
        const vesselType = vessel.type || 'неизвестный тип';
        const vesselLength = vessel.length ? `${vessel.length} м` : 'неизвестная длина';
        const vesselWidth = vessel.width ? `${vessel.width} м` : '';
        const bookingsInfo = activeBookings.length > 0 
          ? ` (примеры ID: ${activeBookings.slice(0, 5).map(b => b.id).join(', ')})`
          : '';
        const description = `${userName || 'Пользователь'} неудачная попытка удаления катера "${vesselName}" (${vesselType}, длина: ${vesselLength}${vesselWidth ? `, ширина: ${vesselWidth}` : ''}). Причина: на катер есть активные брони (${activeBookings.length} шт.)${bookingsInfo}`;

        // Логируем неудачную попытку удаления
        await ActivityLogService.logActivity({
          activityType: ActivityType.OTHER,
          entityType: EntityType.VESSEL,
          entityId: vessel.id,
          userId: req.userId || null,
          description,
          oldValues: null,
          newValues: null,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          userAgent: req.headers['user-agent'] || null,
        });
        alreadyLogged = true;

        throw new AppError(`Нельзя удалить катер с активными бронями. Найдено активных броней: ${activeBookings.length}`, 400);
      }

      // Сохраняем данные для логирования перед удалением
      const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
      const vesselName = vessel.name || 'неизвестное судно';
      const vesselType = vessel.type || 'неизвестный тип';
      const vesselLength = vessel.length ? `${vessel.length} м` : 'неизвестная длина';
      const vesselWidth = vessel.width ? `${vessel.width} м` : '';
      const vesselId = vessel.id;

      // Используем транзакцию для атомарности операций
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        console.log(`[Vessel Delete] Начало транзакции для удаления судна ${vesselId}`);

        // Получаем репозитории в транзакции
        const paymentRepositoryTransaction = queryRunner.manager.getRepository(Payment);
        const bookingRepositoryTransaction = queryRunner.manager.getRepository(Booking);
        const vesselRepositoryTransaction = queryRunner.manager.getRepository(Vessel);

        // Если есть только отмененные брони - удаляем их перед удалением катера
        if (cancelledBookings.length > 0) {
          console.log(`[Vessel Delete] Удаляем ${cancelledBookings.length} отмененных броней перед удалением катера`);
          
          const cancelledBookingIds = cancelledBookings.map(b => b.id);

          // Удаляем платежи, связанные с отмененными бронями
          const deletedPayments = await paymentRepositoryTransaction.delete({
            bookingId: In(cancelledBookingIds),
          });
          
          console.log(`[Vessel Delete] Удалено платежей: ${deletedPayments.affected || 0}`);

          // Удаляем отмененные брони
          const deletedBookings = await bookingRepositoryTransaction.delete({
            id: In(cancelledBookingIds),
          });
          
          console.log(`[Vessel Delete] Удалено отмененных броней: ${deletedBookings.affected || 0}`);

          // Проверяем, что все брони действительно удалены
          const remainingBookings = await bookingRepositoryTransaction.count({
            where: { vesselId: vesselId },
          });
          
          if (remainingBookings > 0) {
            console.error(`[Vessel Delete] ОШИБКА: После удаления осталось ${remainingBookings} броней для судна ${vesselId}`);
            throw new AppError(`Не удалось удалить все брони. Осталось: ${remainingBookings}`, 500);
          }
          
          console.log(`[Vessel Delete] Все отмененные брони успешно удалены`);
        }

        // Проверяем еще раз, что нет активных броней
        const finalBookingsCheck = await bookingRepositoryTransaction.count({
          where: { vesselId: vesselId },
        });

        if (finalBookingsCheck > 0) {
          console.error(`[Vessel Delete] ОШИБКА: Найдено ${finalBookingsCheck} активных броней для судна ${vesselId}`);
          throw new AppError(`Нельзя удалить катер с активными бронями. Найдено: ${finalBookingsCheck}`, 400);
        }

        console.log(`[Vessel Delete] Попытка удаления судна ${vesselId} в транзакции`);
        // Удаляем катер в транзакции
        const deleteResult = await vesselRepositoryTransaction.delete(vesselId);
        console.log(`[Vessel Delete] Результат удаления:`, deleteResult);
        
        if (deleteResult.affected === 0) {
          throw new AppError('Судно не было удалено из базы данных', 500);
        }
        
        // Коммитим транзакцию
        await queryRunner.commitTransaction();
        console.log(`[Vessel Delete] Судно ${vesselId} успешно удалено, транзакция закоммичена`);

        // Логируем успешное удаление ПОСЛЕ коммита транзакции
        const description = `${userName || 'Пользователь'} удалил катер "${vesselName}" (${vesselType}, длина: ${vesselLength}${vesselWidth ? `, ширина: ${vesselWidth}` : ''})`;

        await ActivityLogService.logActivity({
          activityType: ActivityType.DELETE,
          entityType: EntityType.VESSEL,
          entityId: vesselId,
          userId: req.userId || null,
          description,
          oldValues: null,
          newValues: null,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          userAgent: req.headers['user-agent'] || null,
        });

        res.json({ message: 'Судно удалено' });
      } catch (removeError: any) {
        // Откатываем транзакцию в случае ошибки
        try {
          await queryRunner.rollbackTransaction();
          console.log(`[Vessel Delete] Транзакция откачена`);
        } catch (rollbackError) {
          console.error(`[Vessel Delete] Ошибка при откате транзакции:`, rollbackError);
        }
        console.error(`[Vessel Delete] Ошибка при удалении судна ${vesselId}:`, removeError);
        console.error(`[Vessel Delete] Сообщение об ошибке:`, removeError?.message);
        console.error(`[Vessel Delete] Код ошибки:`, removeError?.code);
        
        // Если удаление не удалось из-за внешних ключей или других причин
        let errorMessage = removeError?.message || 'неизвестная ошибка при удалении';
        const isForeignKeyError = 
          errorMessage.includes('foreign key constraint') || 
          errorMessage.includes('violates foreign key') ||
          errorMessage.includes('FK_') ||
          removeError?.code === '23503'; // PostgreSQL код ошибки для нарушения внешнего ключа
        
        if (isForeignKeyError) {
          console.log(`[Vessel Delete] Обнаружена ошибка внешнего ключа, проверяем брони...`);
          // Дополнительно проверяем наличие броней (на случай, если первая проверка не сработала)
          const bookingsCountAfterError = await bookingRepository.count({
            where: { vesselId: vesselId },
          });
          
          console.log(`[Vessel Delete] После ошибки найдено броней: ${bookingsCountAfterError}`);
          
          if (bookingsCountAfterError > 0) {
            errorMessage = `на катер есть брони (${bookingsCountAfterError} шт.)`;
          } else {
            errorMessage = 'есть связанные записи в базе данных (брони или платежи)';
          }
        }
        
        const description = `${userName || 'Пользователь'} неудачная попытка удаления катера "${vesselName}" (${vesselType}, длина: ${vesselLength}${vesselWidth ? `, ширина: ${vesselWidth}` : ''}). Причина: ${errorMessage}`;

        // Логируем неудачную попытку удаления
        await ActivityLogService.logActivity({
          activityType: ActivityType.OTHER,
          entityType: EntityType.VESSEL,
          entityId: vesselId,
          userId: req.userId || null,
          description,
          oldValues: null,
          newValues: null,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          userAgent: req.headers['user-agent'] || null,
        }).catch((logError) => {
          console.error('Ошибка логирования неудачной попытки удаления:', logError);
        });
        alreadyLogged = true;

        // Формируем понятное сообщение об ошибке для пользователя
        // ВСЕГДА заменяем техническое сообщение на понятное
        let userFriendlyMessage = 'Не удалось удалить катер. ';
        if (errorMessage.includes('брони')) {
          userFriendlyMessage += errorMessage;
        } else if (errorMessage.includes('связанные записи')) {
          userFriendlyMessage += errorMessage;
        } else if (isForeignKeyError) {
          // Если это ошибка внешнего ключа, но мы не нашли брони, все равно говорим о связанных записях
          userFriendlyMessage += 'Есть связанные записи в базе данных (брони или платежи).';
        } else {
          userFriendlyMessage += 'Возможно, есть связанные записи (брони или платежи).';
        }

        // ВАЖНО: Всегда выбрасываем AppError с понятным сообщением, никогда не пробрасываем техническую ошибку
        throw new AppError(userFriendlyMessage, 400);
      } finally {
        // Освобождаем соединение
        await queryRunner.release();
      }
    } catch (error: any) {
      console.error(`[Vessel Delete] Внешний catch блок. Ошибка:`, error);
      console.error(`[Vessel Delete] Тип ошибки:`, error?.constructor?.name);
      console.error(`[Vessel Delete] Сообщение:`, error?.message);
      console.error(`[Vessel Delete] Код:`, error?.code);
      console.error(`[Vessel Delete] alreadyLogged:`, alreadyLogged);
      
      // Если это AppError, просто пробрасываем его дальше (он уже имеет понятное сообщение)
      if (error instanceof AppError) {
        console.log(`[Vessel Delete] Это AppError, пробрасываем дальше`);
        return next(error);
      }

      // Если это не ошибка из-за броней и мы еще не залогировали, логируем неудачную попытку
      if (vessel && error.message && !error.message.includes('бронями') && !alreadyLogged) {
        const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
        const vesselName = vessel.name || 'неизвестное судно';
        const vesselType = vessel.type || 'неизвестный тип';
        const vesselLength = vessel.length ? `${vessel.length} м` : 'неизвестная длина';
        const vesselWidth = vessel.width ? `${vessel.width} м` : '';
        
        // Проверяем, является ли это ошибкой внешнего ключа
        const isForeignKeyError = 
          error.message?.includes('foreign key constraint') || 
          error.message?.includes('violates foreign key') ||
          error.message?.includes('FK_') ||
          error.code === '23503';
        
        let errorMessage = 'неизвестная ошибка';
        if (isForeignKeyError) {
          errorMessage = 'есть связанные записи в базе данных (брони или платежи)';
        } else {
          errorMessage = error.message || 'неизвестная ошибка';
        }
        
        const description = `${userName || 'Пользователь'} неудачная попытка удаления катера "${vesselName}" (${vesselType}, длина: ${vesselLength}${vesselWidth ? `, ширина: ${vesselWidth}` : ''}). Причина: ${errorMessage}`;

        // Логируем неудачную попытку удаления
        await ActivityLogService.logActivity({
          activityType: ActivityType.OTHER,
          entityType: EntityType.VESSEL,
          entityId: vessel.id,
          userId: req.userId || null,
          description,
          oldValues: null,
          newValues: null,
          ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
          userAgent: req.headers['user-agent'] || null,
        }).catch((logError) => {
          console.error('Ошибка логирования неудачной попытки удаления:', logError);
        });
        
        // ВСЕГДА преобразуем техническую ошибку в понятное сообщение
        const userFriendlyMessage = isForeignKeyError
          ? 'Не удалось удалить катер. Есть связанные записи в базе данных (брони или платежи).'
          : `Не удалось удалить катер. ${errorMessage}`;
        
        return next(new AppError(userFriendlyMessage, 400));
      }

      // Если это техническая ошибка, преобразуем ее в понятное сообщение
      if (error.message?.includes('foreign key constraint') || 
          error.message?.includes('violates foreign key') ||
          error.message?.includes('FK_') ||
          error.code === '23503') {
        return next(new AppError('Не удалось удалить катер. Есть связанные записи в базе данных (брони или платежи).', 400));
      }

      // Для всех остальных ошибок также преобразуем в понятное сообщение
      return next(new AppError('Не удалось удалить катер. Возможно, есть связанные записи.', 400));
    }
  }

  async hide(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vesselId = parseInt(id);

      if (isNaN(vesselId)) {
        throw new AppError('Неверный ID судна', 400);
      }

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: vesselId },
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа - только владелец или супер-администратор может скрывать суда
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin'
      ) {
        throw new AppError('Недостаточно прав для скрытия судна', 403);
      }

      // Устанавливаем судно как неактивное и сбрасываем статус публикации
      vessel.isActive = false;
      vessel.isValidated = false;
      vessel.isSubmittedForValidation = false;
      await vesselRepository.save(vessel);

      res.json({ message: 'Судно успешно скрыто. Статус публикации сброшен.' });
    } catch (error) {
      next(error);
    }
  }

  async restore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const vesselId = parseInt(id);

      if (isNaN(vesselId)) {
        throw new AppError('Неверный ID судна', 400);
      }

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: vesselId },
      });

      if (!vessel) {
        throw new AppError('Судно не найдено', 404);
      }

      // Проверка прав доступа - только владелец или супер-администратор может восстанавливать суда
      if (
        vessel.ownerId !== req.userId &&
        req.userRole !== 'super_admin'
      ) {
        throw new AppError('Недостаточно прав для восстановления судна', 403);
      }

      // Устанавливаем судно как активное
      vessel.isActive = true;
      await vesselRepository.save(vessel);

      res.json({ message: 'Судно успешно восстановлено' });
    } catch (error) {
      next(error);
    }
  }
}



