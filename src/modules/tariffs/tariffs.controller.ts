import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { Tariff } from '../../entities/Tariff';
import { TariffBerth } from '../../entities/TariffBerth';
import { Club } from '../../entities/Club';
import { Berth } from '../../entities/Berth';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { TariffType } from '../../entities/Tariff';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { ActivityLogService } from '../../services/activityLog.service';
import { ActivityType, EntityType } from '../../entities/ActivityLog';
import { generateActivityDescription } from '../../utils/activityLogDescription';

export class TariffsController {
  // Получить все тарифы клуба
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
      if (req.userRole === 'club_owner' && req.userId !== club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      const tariffRepository = AppDataSource.getRepository(Tariff);
      const tariffs = await tariffRepository.find({
        where: { clubId: parseInt(clubId) },
        relations: ['tariffBerths', 'tariffBerths.berth'],
        order: { createdAt: 'DESC' },
      });

      // Преобразуем данные для удобства
      const tariffsWithBerths = tariffs.map((tariff) => ({
        ...tariff,
        berths: tariff.tariffBerths?.map((tb) => tb.berth) || [],
      }));

      res.json(tariffsWithBerths);
    } catch (error) {
      next(error);
    }
  }

  // Создать новый тариф
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { clubId, name, type, amount, season, berthIds, months, monthlyAmounts } = req.body;

      if (!clubId || !name || !type) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      // Для оплаты за сезон amount обязателен
      if (type === TariffType.SEASON_PAYMENT && !amount) {
        throw new AppError('Сумма обязательна для оплаты за сезон', 400);
      }

      if (!Object.values(TariffType).includes(type)) {
        throw new AppError('Неверный тип тарифа', 400);
      }

      if (parseFloat(amount) < 0) {
        throw new AppError('Сумма не может быть отрицательной', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(clubId) },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверяем права доступа
      if (req.userRole === 'club_owner' && req.userId !== club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      // Используем season клуба, если season не передан
      const tariffSeason = season ? parseInt(season) : (club.season || new Date().getFullYear());

      // Проверяем, что места принадлежат клубу
      if (berthIds && Array.isArray(berthIds) && berthIds.length > 0) {
        const berthRepository = AppDataSource.getRepository(Berth);
        const berths = await berthRepository.find({
          where: berthIds.map((id: number) => ({ id, clubId: parseInt(clubId) })),
        });

        if (berths.length !== berthIds.length) {
          throw new AppError('Некоторые места не найдены или не принадлежат этому клубу', 400);
        }
      }

      // Валидация месяцев для помесячной оплаты
      if (type === TariffType.MONTHLY_PAYMENT) {
        if (!months || !Array.isArray(months) || months.length === 0) {
          throw new AppError('Для помесячной оплаты необходимо выбрать хотя бы один месяц', 400);
        }
        // Проверяем, что все месяцы в диапазоне 1-12
        const invalidMonths = months.filter((m: number) => m < 1 || m > 12);
        if (invalidMonths.length > 0) {
          throw new AppError('Месяца должны быть в диапазоне от 1 до 12', 400);
        }
        // Валидация monthlyAmounts
        if (!monthlyAmounts || typeof monthlyAmounts !== 'object') {
          throw new AppError('Для помесячной оплаты необходимо указать суммы для каждого месяца', 400);
        }
        // Проверяем, что для каждого выбранного месяца указана сумма
        for (const month of months) {
          if (!monthlyAmounts[month] || parseFloat(monthlyAmounts[month]) <= 0) {
            const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            throw new AppError(`Необходимо указать сумму для месяца "${monthNames[month]}"`, 400);
          }
        }
      }

      const tariffRepository = AppDataSource.getRepository(Tariff);
      // Преобразуем monthlyAmounts в числа
      const monthlyAmountsNumeric: { [month: number]: number } | null = 
        type === TariffType.MONTHLY_PAYMENT && monthlyAmounts
          ? Object.keys(monthlyAmounts).reduce((acc, monthStr) => {
              const month = parseInt(monthStr);
              acc[month] = parseFloat(monthlyAmounts[month]);
              return acc;
            }, {} as { [month: number]: number })
          : null;

      const tariff = tariffRepository.create({
        name,
        type,
        amount: parseFloat(amount),
        season: tariffSeason,
        clubId: parseInt(clubId),
        months: type === TariffType.MONTHLY_PAYMENT ? months : null,
        monthlyAmounts: monthlyAmountsNumeric,
      });

      const savedTariff = await tariffRepository.save(tariff);

      // Создаем связи с местами
      if (berthIds && Array.isArray(berthIds) && berthIds.length > 0) {
        const tariffBerthRepository = AppDataSource.getRepository(TariffBerth);
        const tariffBerths = berthIds.map((berthId: number) =>
          tariffBerthRepository.create({
            tariffId: savedTariff.id,
            berthId,
          })
        );
        await tariffBerthRepository.save(tariffBerths);
      }

      // Загружаем тариф с местами
      const tariffWithBerths = await tariffRepository.findOne({
        where: { id: savedTariff.id },
        relations: ['tariffBerths', 'tariffBerths.berth'],
      });

      const result = {
        ...tariffWithBerths,
        berths: tariffWithBerths?.tariffBerths?.map((tb) => tb.berth) || [],
      };

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  // Обновить тариф
  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, type, amount, season, berthIds, months, monthlyAmounts } = req.body;

      const tariffRepository = AppDataSource.getRepository(Tariff);
      const tariff = await tariffRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!tariff) {
        throw new AppError('Тариф не найден', 404);
      }

      // Проверяем права доступа
      if (req.userRole === 'club_owner' && req.userId !== tariff.club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      // Сохраняем старые значения для логирования
      const oldValues = {
        name: tariff.name,
        type: tariff.type,
        amount: tariff.amount,
        season: tariff.season,
        months: tariff.months,
        monthlyAmounts: tariff.monthlyAmounts,
        clubId: tariff.clubId,
      };

      if (name !== undefined) tariff.name = name;
      if (type !== undefined) {
        if (!Object.values(TariffType).includes(type)) {
          throw new AppError('Неверный тип тарифа', 400);
        }
        tariff.type = type;
      }
      if (amount !== undefined) {
        if (parseFloat(amount) < 0) {
          throw new AppError('Сумма не может быть отрицательной', 400);
        }
        tariff.amount = parseFloat(amount);
      }
      if (season !== undefined) tariff.season = parseInt(season);
      
      // Обновляем месяцы для помесячной оплаты
      if (type !== undefined && type === TariffType.MONTHLY_PAYMENT) {
        // Валидация месяцев для помесячной оплаты
        if (!months || !Array.isArray(months) || months.length === 0) {
          throw new AppError('Для помесячной оплаты необходимо выбрать хотя бы один месяц', 400);
        }
        // Проверяем, что все месяцы в диапазоне 1-12
        const invalidMonths = months.filter((m: number) => m < 1 || m > 12);
        if (invalidMonths.length > 0) {
          throw new AppError('Месяца должны быть в диапазоне от 1 до 12', 400);
        }
        tariff.months = months;
        // Валидация и обновление monthlyAmounts
        if (monthlyAmounts !== undefined) {
          if (!monthlyAmounts || typeof monthlyAmounts !== 'object') {
            throw new AppError('Для помесячной оплаты необходимо указать суммы для каждого месяца', 400);
          }
          // Проверяем, что для каждого выбранного месяца указана сумма
          for (const month of months) {
            if (!monthlyAmounts[month] || parseFloat(monthlyAmounts[month]) <= 0) {
              const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
              throw new AppError(`Необходимо указать сумму для месяца "${monthNames[month]}"`, 400);
            }
          }
          // Преобразуем monthlyAmounts в числа
          const monthlyAmountsNumeric: { [month: number]: number } = {};
          Object.keys(monthlyAmounts).forEach((monthStr) => {
            const month = parseInt(monthStr);
            monthlyAmountsNumeric[month] = parseFloat(monthlyAmounts[month]);
          });
          tariff.monthlyAmounts = monthlyAmountsNumeric;
        }
      } else if (type !== undefined && type === TariffType.SEASON_PAYMENT) {
        // Для оплаты за сезон месяцы не нужны
        tariff.months = null;
        tariff.monthlyAmounts = null;
      } else if (months !== undefined) {
        // Если тип не меняется, но месяцы переданы
        if (tariff.type === TariffType.MONTHLY_PAYMENT) {
          if (!months || !Array.isArray(months) || months.length === 0) {
            throw new AppError('Для помесячной оплаты необходимо выбрать хотя бы один месяц', 400);
          }
          const invalidMonths = months.filter((m: number) => m < 1 || m > 12);
          if (invalidMonths.length > 0) {
            throw new AppError('Месяца должны быть в диапазоне от 1 до 12', 400);
          }
          tariff.months = months;
          // Обновляем monthlyAmounts если переданы
          if (monthlyAmounts !== undefined) {
            if (!monthlyAmounts || typeof monthlyAmounts !== 'object') {
              throw new AppError('Для помесячной оплаты необходимо указать суммы для каждого месяца', 400);
            }
            // Проверяем, что для каждого выбранного месяца указана сумма
            for (const month of months) {
              if (!monthlyAmounts[month] || parseFloat(monthlyAmounts[month]) <= 0) {
                const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
                throw new AppError(`Необходимо указать сумму для месяца "${monthNames[month]}"`, 400);
              }
            }
            // Преобразуем monthlyAmounts в числа
            const monthlyAmountsNumeric: { [month: number]: number } = {};
            Object.keys(monthlyAmounts).forEach((monthStr) => {
              const month = parseInt(monthStr);
              monthlyAmountsNumeric[month] = parseFloat(monthlyAmounts[month]);
            });
            tariff.monthlyAmounts = monthlyAmountsNumeric;
          }
        } else {
          tariff.months = null;
          tariff.monthlyAmounts = null;
        }
      } else if (monthlyAmounts !== undefined && tariff.type === TariffType.MONTHLY_PAYMENT) {
        // Если месяцы не меняются, но monthlyAmounts переданы
        if (!monthlyAmounts || typeof monthlyAmounts !== 'object') {
          throw new AppError('Для помесячной оплаты необходимо указать суммы для каждого месяца', 400);
        }
        const currentMonths = tariff.months || [];
        // Проверяем, что для каждого выбранного месяца указана сумма
        for (const month of currentMonths) {
          if (!monthlyAmounts[month] || parseFloat(monthlyAmounts[month]) <= 0) {
            const monthNames = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            throw new AppError(`Необходимо указать сумму для месяца "${monthNames[month]}"`, 400);
          }
        }
        // Преобразуем monthlyAmounts в числа
        const monthlyAmountsNumeric: { [month: number]: number } = {};
        Object.keys(monthlyAmounts).forEach((monthStr) => {
          const month = parseInt(monthStr);
          monthlyAmountsNumeric[month] = parseFloat(monthlyAmounts[month]);
        });
        tariff.monthlyAmounts = monthlyAmountsNumeric;
      }

      await tariffRepository.save(tariff);

      // Обновляем связи с местами
      if (berthIds !== undefined) {
        const tariffBerthRepository = AppDataSource.getRepository(TariffBerth);
        
        // Удаляем старые связи
        await tariffBerthRepository.delete({ tariffId: tariff.id });

        // Создаем новые связи
        if (Array.isArray(berthIds) && berthIds.length > 0) {
          // Проверяем, что места принадлежат клубу
          const berthRepository = AppDataSource.getRepository(Berth);
          const berths = await berthRepository.find({
            where: berthIds.map((berthId: number) => ({ id: berthId, clubId: tariff.clubId })),
          });

          if (berths.length !== berthIds.length) {
            throw new AppError('Некоторые места не найдены или не принадлежат этому клубу', 400);
          }

          const tariffBerths = berthIds.map((berthId: number) =>
            tariffBerthRepository.create({
              tariffId: tariff.id,
              berthId,
            })
          );
          await tariffBerthRepository.save(tariffBerths);
        }
      }

      // Загружаем обновленный тариф с местами
      const updatedTariff = await tariffRepository.findOne({
        where: { id: tariff.id },
        relations: ['tariffBerths', 'tariffBerths.berth'],
      });

      const result = {
        ...updatedTariff,
        berths: updatedTariff?.tariffBerths?.map((tb) => tb.berth) || [],
      };

      // Формируем новые значения для логирования
      const newValues = {
        name: updatedTariff!.name,
        type: updatedTariff!.type,
        amount: updatedTariff!.amount,
        season: updatedTariff!.season,
        months: updatedTariff!.months,
        monthlyAmounts: updatedTariff!.monthlyAmounts,
        clubId: updatedTariff!.clubId,
      };

      // Логируем обновление с детальным описанием изменений
      const userName = req.user ? `${req.user.firstName} ${req.user.lastName}`.trim() : null;
      const description = generateActivityDescription(
        ActivityType.UPDATE,
        EntityType.TARIFF,
        tariff.id,
        userName,
        updatedTariff!.name,
        oldValues,
        newValues
      );

      await ActivityLogService.logActivity({
        activityType: ActivityType.UPDATE,
        entityType: EntityType.TARIFF,
        entityId: tariff.id,
        userId: req.userId || null,
        description,
        oldValues,
        newValues,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
      });

      // Помечаем, что детальное логирование уже выполнено, чтобы избежать дублирования
      (res as any).locals = { ...(res as any).locals, skipAutoLogging: true };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // Удалить тариф
  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const tariffRepository = AppDataSource.getRepository(Tariff);
      const tariff = await tariffRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['club'],
      });

      if (!tariff) {
        throw new AppError('Тариф не найден', 404);
      }

      // Проверяем права доступа
      if (req.userRole === 'club_owner' && req.userId !== tariff.club.ownerId) {
        throw new AppError('Доступ запрещен', 403);
      }

      // Удаляем связи с местами (каскадное удаление)
      const tariffBerthRepository = AppDataSource.getRepository(TariffBerth);
      await tariffBerthRepository.delete({ tariffId: tariff.id });

      // Удаляем тариф
      await tariffRepository.remove(tariff);

      res.json({ message: 'Тариф успешно удален' });
    } catch (error) {
      next(error);
    }
  }
}

