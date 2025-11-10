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
      const { clubId, name, type, amount, season, berthIds, months } = req.body;

      if (!clubId || !name || !type || !amount || !season) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
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
      }

      const tariffRepository = AppDataSource.getRepository(Tariff);
      const tariff = tariffRepository.create({
        name,
        type,
        amount: parseFloat(amount),
        season: parseInt(season),
        clubId: parseInt(clubId),
        months: type === TariffType.MONTHLY_PAYMENT ? months : null,
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
      const { name, type, amount, season, berthIds, months } = req.body;

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
      } else if (type !== undefined && type === TariffType.SEASON_PAYMENT) {
        // Для оплаты за сезон месяцы не нужны
        tariff.months = null;
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
        } else {
          tariff.months = null;
        }
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

