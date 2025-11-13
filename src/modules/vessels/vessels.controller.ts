import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Vessel } from '../../entities/Vessel';
import { User } from '../../entities/User';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';

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

      res.json(createPaginatedResponse(vessels, total, page, limit));
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
        photo,
      } = req.body;

      if (!name || !type || !length || !width) {
        throw new AppError('Все обязательные поля должны быть заполнены (название, тип, длина, ширина)', 400);
      }

      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = vesselRepository.create({
        name: name as string,
        type: type as string,
        length: parseFloat(length as string),
        width: parseFloat(width as string),
        heightAboveWaterline: heightAboveWaterline ? parseFloat(heightAboveWaterline as string) : undefined,
        registrationNumber: registrationNumber as string | undefined,
        documentPath: documentPath as string | undefined,
        technicalSpecs: technicalSpecs ? JSON.stringify(technicalSpecs) : undefined,
        photo: photo as string | undefined,
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

      await vesselRepository.save(vessel);

      const updatedVessel = await vesselRepository.findOne({
        where: { id: vessel.id },
        relations: ['owner'],
      });

      res.json(updatedVessel);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const vesselRepository = AppDataSource.getRepository(Vessel);
      const vessel = await vesselRepository.findOne({
        where: { id: parseInt(id) },
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

      await vesselRepository.remove(vessel);

      res.json({ message: 'Судно удалено' });
    } catch (error) {
      next(error);
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



