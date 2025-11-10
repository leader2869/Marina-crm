import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { BookingRule, BookingRuleType } from '../../entities/BookingRule';
import { Club } from '../../entities/Club';
import { Tariff } from '../../entities/Tariff';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { UserRole } from '../../types';

export class BookingRulesController {
  // Получить все правила клуба
  async getByClub(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId } = req.params;

      if (!clubId) {
        throw new AppError('ID клуба обязателен', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверяем права доступа
      if (req.userRole === UserRole.CLUB_OWNER && req.userId !== club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
      const rules = await bookingRuleRepository.find({
        where: { clubId: parseInt(clubId) },
        relations: ['club', 'tariff'],
        order: { createdAt: 'DESC' },
      });

      res.json(rules);
    } catch (error) {
      next(error);
    }
  }

  // Создать правило
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { clubId, tariffId, ruleType, description, parameters } = req.body;

      if (!clubId || !ruleType || !description) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверяем права доступа
      if (req.userRole === UserRole.CLUB_OWNER && req.userId !== club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      // Если указан тариф, проверяем его существование и принадлежность клубу
      if (tariffId) {
        const tariffRepository = AppDataSource.getRepository(Tariff);
        const tariff = await tariffRepository.findOne({
          where: { id: parseInt(tariffId) },
        });

        if (!tariff) {
          throw new AppError('Тариф не найден', 404);
        }

        if (tariff.clubId !== parseInt(clubId)) {
          throw new AppError('Тариф не принадлежит выбранному клубу', 400);
        }
      }

      const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
      const rule = bookingRuleRepository.create({
        clubId: parseInt(clubId),
        tariffId: tariffId ? parseInt(tariffId) : null,
        ruleType: ruleType as BookingRuleType,
        description,
        parameters: parameters || null,
      });

      await bookingRuleRepository.save(rule);

      // Загружаем правило с отношениями
      const savedRule = await bookingRuleRepository.findOne({
        where: { id: rule.id },
        relations: ['club', 'tariff'],
      });

      res.status(201).json(savedRule);
    } catch (error) {
      next(error);
    }
  }

  // Обновить правило
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const { clubId, tariffId, ruleType, description, parameters } = req.body;

      const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
      const rule = await bookingRuleRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!rule) {
        throw new AppError('Правило не найдено', 404);
      }

      // Проверяем права доступа
      if (req.userRole === UserRole.CLUB_OWNER && req.userId !== rule.club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      // Обновляем поля
      if (clubId !== undefined) {
        const clubRepository = AppDataSource.getRepository(Club);
        const club = await clubRepository.findOne({
          where: { id: parseInt(clubId) },
        });

        if (!club) {
          throw new AppError('Яхт-клуб не найден', 404);
        }

        if (req.userRole === UserRole.CLUB_OWNER && req.userId !== club.ownerId) {
          throw new AppError('Доступ запрещен', 403);
        }

        rule.clubId = parseInt(clubId);
      }

      if (tariffId !== undefined) {
        if (tariffId) {
          const tariffRepository = AppDataSource.getRepository(Tariff);
          const tariff = await tariffRepository.findOne({
            where: { id: parseInt(tariffId) },
          });

          if (!tariff) {
            throw new AppError('Тариф не найден', 404);
          }

          if (tariff.clubId !== rule.clubId) {
            throw new AppError('Тариф не принадлежит выбранному клубу', 400);
          }

          rule.tariffId = parseInt(tariffId);
        } else {
          rule.tariffId = null;
        }
      }

      if (ruleType !== undefined) {
        rule.ruleType = ruleType as BookingRuleType;
      }

      if (description !== undefined) {
        rule.description = description;
      }

      if (parameters !== undefined) {
        rule.parameters = parameters || null;
      }

      await bookingRuleRepository.save(rule);

      // Загружаем обновленное правило с отношениями
      const updatedRule = await bookingRuleRepository.findOne({
        where: { id: rule.id },
        relations: ['club', 'tariff'],
      });

      res.json(updatedRule);
    } catch (error) {
      next(error);
    }
  }

  // Удалить правило
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;

      const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
      const rule = await bookingRuleRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!rule) {
        throw new AppError('Правило не найдено', 404);
      }

      // Проверяем права доступа
      if (req.userRole === UserRole.CLUB_OWNER && req.userId !== rule.club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      await bookingRuleRepository.remove(rule);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

