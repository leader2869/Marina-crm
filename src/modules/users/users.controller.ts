import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { Payment } from '../../entities/Payment';
import { Club } from '../../entities/Club';
import { UserClub } from '../../entities/UserClub';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { PaymentStatus, UserRole } from '../../types';
import { hashPassword } from '../../utils/password';
import { ActivityLogService } from '../../services/activityLog.service';
import { ActivityType, EntityType } from '../../entities/ActivityLog';
import { generateActivityDescription } from '../../utils/activityLogDescription';

export class UsersController {
  // Вспомогательный метод для нормализации номера телефона
  private normalizePhone(phone: string): string {
    if (!phone) return '';
    // Убираем все нецифровые символы
    let normalized = phone.replace(/\D/g, '');
    // Если начинается с 8, заменяем на 7
    if (normalized.startsWith('8')) {
      normalized = '7' + normalized.substring(1);
    }
    // Если не начинается с 7, добавляем 7
    if (!normalized.startsWith('7')) {
      normalized = '7' + normalized;
    }
    // Возвращаем последние 10 цифр (код страны + номер)
    return normalized.slice(-10);
  }

  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может видеть всех пользователей
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const userRepository = AppDataSource.getRepository(User);
      const paymentRepository = AppDataSource.getRepository(Payment);

      // Получаем всех пользователей с их связями
      const [users, total] = await userRepository
        .createQueryBuilder('user')
        .leftJoinAndSelect('user.ownedClubs', 'ownedClubs')
        .leftJoinAndSelect('user.managedClub', 'managedClub')
        .leftJoinAndSelect('user.managedClubs', 'managedClubs')
        .leftJoinAndSelect('managedClubs.club', 'managedClubDetails')
        .leftJoinAndSelect('user.vessels', 'vessels')
        .skip((page - 1) * limit)
        .take(limit)
        .orderBy('user.createdAt', 'DESC')
        .getManyAndCount();

      // Для каждого пользователя вычисляем задолженность
      const usersWithDebt = await Promise.all(
        users.map(async (user) => {
          // Находим все неоплаченные платежи пользователя (PENDING или OVERDUE)
          // или просроченные платежи (PENDING со сроком оплаты в прошлом)
          const now = new Date();
          const unpaidPayments = await paymentRepository
            .createQueryBuilder('payment')
            .where('payment.payerId = :userId', { userId: user.id })
            .andWhere(
              '(payment.status = :overdueStatus OR (payment.status = :pendingStatus AND payment.dueDate < :now))',
              {
                overdueStatus: PaymentStatus.OVERDUE,
                pendingStatus: PaymentStatus.PENDING,
                now: now,
              }
            )
            .getMany();

          // Вычисляем общую задолженность (сумма + пеня)
          const totalDebt = unpaidPayments.reduce((sum, payment) => {
            const paymentAmount = parseFloat(payment.amount.toString());
            const penaltyAmount = parseFloat(payment.penalty.toString());
            return sum + paymentAmount + penaltyAmount;
          }, 0);

          // Определяем к каким клубам привязан пользователь
          const clubNames: string[] = [];
          
          // Добавляем клубы из managedClubs (новая связь многие-ко-многим)
          if (user.managedClubs && user.managedClubs.length > 0) {
            user.managedClubs.forEach((uc) => {
              if (uc.club && !clubNames.includes(uc.club.name)) {
                clubNames.push(uc.club.name);
              }
            });
          }
          
          // Добавляем клуб из старой связи managedClub (для обратной совместимости)
          if (user.managedClub && !clubNames.includes(user.managedClub.name)) {
            clubNames.push(user.managedClub.name);
          }
          
          // Добавляем клубы из ownedClubs
          if (user.ownedClubs && user.ownedClubs.length > 0) {
            user.ownedClubs.forEach((club) => {
              if (!clubNames.includes(club.name)) {
                clubNames.push(club.name);
              }
            });
          }

          return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone || '-',
            role: user.role,
            clubName: clubNames.length > 0 ? clubNames.join(', ') : '-',
            debt: totalDebt,
            createdAt: user.createdAt,
            vessels: user.vessels || [],
          };
        })
      );

      res.json(createPaginatedResponse(usersWithDebt, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getGuests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может видеть гостей
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const { page, limit, afterDate } = req.query;

      const userRepository = AppDataSource.getRepository(User);
      const queryBuilder = userRepository
        .createQueryBuilder('user')
        .where('user.role = :role', { role: UserRole.GUEST });

      // Если указана дата, фильтруем гостей, созданных после этой даты
      if (afterDate) {
        const afterDateObj = new Date(afterDate as string);
        queryBuilder.andWhere('user.createdAt > :afterDate', { afterDate: afterDateObj });
      }

      // Если запрашивается только количество (без пагинации)
      if (req.query.countOnly === 'true') {
        const count = await queryBuilder.getCount();
        res.json({ count });
        return;
      }

      const { page: pageNum, limit: limitNum } = getPaginationParams(
        parseInt(page as string),
        parseInt(limit as string)
      );

      // Получаем всех пользователей с ролью GUEST, отсортированных по дате создания (новые первыми)
      const [guests, total] = await queryBuilder
        .orderBy('user.createdAt', 'DESC')
        .skip((pageNum - 1) * limitNum)
        .take(limitNum)
        .getManyAndCount();

      // Форматируем данные для ответа
      const guestsData = guests.map((guest) => ({
        id: guest.id,
        firstName: guest.firstName,
        phone: guest.phone || '-',
        createdAt: guest.createdAt,
        email: guest.email,
      }));

      res.json(createPaginatedResponse(guestsData, total, pageNum, limitNum));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может видеть детали пользователя
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        throw new AppError('Неверный ID пользователя', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['ownedClubs', 'managedClub', 'managedClubs', 'managedClubs.club', 'vessels'],
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может создавать пользователей
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const { email, password, firstName, lastName, phone, role, managedClubId, clubIds } = req.body;

      if (!email || !password || !firstName || !lastName) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const clubRepository = AppDataSource.getRepository(Club);
      const userClubRepository = AppDataSource.getRepository(UserClub);

      // Проверяем, существует ли пользователь с таким email
      const existingUser = await userRepository.findOne({ where: { email } });
      if (existingUser) {
        throw new AppError('Пользователь с таким email уже существует', 400);
      }

      // Валидация роли
      let userRole: UserRole;
      if (role && Object.values(UserRole).includes(role)) {
        userRole = role as UserRole;
      } else {
        throw new AppError('Неверная роль', 400);
      }

      // Хешируем пароль
      const hashedPassword = await hashPassword(password);

      // Создаем пользователя
      const user = userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone: phone || null,
        role: userRole,
        emailVerified: true,
        isActive: true,
      });

      // Устанавливаем привязку к яхт-клубу, если указана
      if (managedClubId) {
        const clubId = parseInt(managedClubId as string);
        if (!isNaN(clubId)) {
          const club = await clubRepository.findOne({ where: { id: clubId } });
          if (!club) {
            throw new AppError('Яхт-клуб не найден', 404);
          }
          user.managedClubId = clubId;
        }
      }

      await userRepository.save(user);

      // Устанавливаем привязку к нескольким яхт-клубам (новая связь многие-ко-многим)
      if (clubIds && Array.isArray(clubIds) && clubIds.length > 0) {
        for (const clubIdStr of clubIds) {
          const clubId = parseInt(clubIdStr);
          if (!isNaN(clubId)) {
            const club = await clubRepository.findOne({ where: { id: clubId } });
            if (!club) {
              continue; // Пропускаем несуществующие клубы
            }
            
            const userClub = userClubRepository.create({
              userId: user.id,
              clubId: clubId,
            });
            await userClubRepository.save(userClub);
          }
        }
      }

      // Получаем созданного пользователя с связями
      const createdUser = await userRepository.findOne({
        where: { id: user.id },
        relations: ['managedClub', 'managedClubs', 'managedClubs.club', 'ownedClubs'],
      });

      // Логируем создание пользователя
      const currentUser = req.user ? `${req.user.firstName} ${req.user.lastName}` : null;
      const newUserName = `${createdUser!.firstName} ${createdUser!.lastName}`;
      await ActivityLogService.logActivity({
        activityType: ActivityType.CREATE,
        entityType: EntityType.USER,
        entityId: createdUser!.id,
        userId: req.userId || null,
        description: generateActivityDescription(
          ActivityType.CREATE,
          EntityType.USER,
          createdUser!.id,
          currentUser,
          newUserName
        ),
        oldValues: null,
        newValues: null,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
      });

      res.status(201).json({
        message: 'Пользователь успешно создан',
        user: {
          id: createdUser!.id,
          email: createdUser!.email,
          firstName: createdUser!.firstName,
          lastName: createdUser!.lastName,
          phone: createdUser!.phone,
          role: createdUser!.role,
          managedClubId: createdUser!.managedClubId,
          managedClub: createdUser!.managedClub,
          managedClubs: createdUser!.managedClubs || [],
          createdAt: createdUser!.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может обновлять пользователей
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const userId = parseInt(req.params.id);
      const { email, phone, role, managedClubId, clubIds } = req.body;

      if (!userId || isNaN(userId)) {
        throw new AppError('Неверный ID пользователя', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const clubRepository = AppDataSource.getRepository(Club);
      const userClubRepository = AppDataSource.getRepository(UserClub);

      // Находим пользователя
      const user = await userRepository.findOne({
        where: { id: userId },
        relations: ['managedClub', 'managedClubs', 'managedClubs.club', 'ownedClubs'],
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      // Валидация email (если изменяется)
      if (email && email !== user.email) {
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
          throw new AppError('Пользователь с таким email уже существует', 400);
        }
        user.email = email;
      }

      // Обновление телефона с проверкой уникальности
      if (phone !== undefined) {
        if (phone && phone.trim()) {
          // Нормализуем телефон для проверки
          const normalizedPhone = this.normalizePhone(phone);
          
          // Проверяем, не используется ли этот номер другим пользователем
          const allUsers = await userRepository.find({ where: { isActive: true } });
          const existingUserByPhone = allUsers.find(u => {
            if (!u.phone || u.id === userId) return false;
            const normalizedDb = this.normalizePhone(u.phone);
            return normalizedDb === normalizedPhone;
          });
          
          if (existingUserByPhone) {
            throw new AppError('Пользователь с таким номером телефона уже существует', 400);
          }
        }
        user.phone = phone || null;
      }

      // Обновление роли и валидации
      // Если одновременно обновляются роль и isValidated (валидация пользователя)
      if (role && req.body.isValidated !== undefined) {
        // Валидация роли
        if (!Object.values(UserRole).includes(role)) {
          throw new AppError('Неверная роль', 400);
        }
        const newRole = role as UserRole;
        
        // Если валидируем пользователя с PENDING_VALIDATION, меняем роль на CLUB_OWNER
        if (user.role === UserRole.PENDING_VALIDATION && newRole === UserRole.CLUB_OWNER && req.body.isValidated === true) {
          user.role = UserRole.CLUB_OWNER;
          user.isValidated = true;
        } else {
          // Если меняем роль на CLUB_OWNER из другой роли, устанавливаем PENDING_VALIDATION
          if (newRole === UserRole.CLUB_OWNER && user.role !== UserRole.CLUB_OWNER) {
            user.role = UserRole.PENDING_VALIDATION;
            user.isValidated = false;
          } else {
            user.role = newRole;
            user.isValidated = req.body.isValidated === true;
          }
        }
      } else if (role) {
        // Обновление только роли
        if (!Object.values(UserRole).includes(role)) {
          throw new AppError('Неверная роль', 400);
        }
        const newRole = role as UserRole;
        
        // Если меняем роль на CLUB_OWNER из другой роли, устанавливаем PENDING_VALIDATION
        if (newRole === UserRole.CLUB_OWNER && user.role !== UserRole.CLUB_OWNER) {
          user.role = UserRole.PENDING_VALIDATION;
          user.isValidated = false;
        } else {
          user.role = newRole;
        }
      } else if (req.body.isValidated !== undefined) {
        // Обновление только статуса валидации
        user.isValidated = req.body.isValidated === true;
      }

      // Обновление привязки к яхт-клубу (старая связь для обратной совместимости)
      if (managedClubId !== undefined) {
        if (managedClubId === null || managedClubId === '') {
          // Удаляем привязку
          user.managedClubId = null;
          user.managedClub = null;
        } else {
          const clubId = parseInt(managedClubId as string);
          if (isNaN(clubId)) {
            throw new AppError('Неверный ID яхт-клуба', 400);
          }

          // Проверяем существование клуба
          const club = await clubRepository.findOne({ where: { id: clubId } });
          if (!club) {
            throw new AppError('Яхт-клуб не найден', 404);
          }

          user.managedClubId = clubId;
        }
      }

      // Обновление привязки к нескольким яхт-клубам (новая связь многие-ко-многим)
      if (clubIds !== undefined) {
        // Удаляем все существующие связи
        await userClubRepository.delete({ userId: user.id });

        // Создаем новые связи
        if (Array.isArray(clubIds) && clubIds.length > 0) {
          for (const clubIdStr of clubIds) {
            const clubId = parseInt(clubIdStr);
            if (!isNaN(clubId)) {
              const club = await clubRepository.findOne({ where: { id: clubId } });
              if (!club) {
                continue; // Пропускаем несуществующие клубы
              }

              const userClub = userClubRepository.create({
                userId: user.id,
                clubId: clubId,
              });
              await userClubRepository.save(userClub);
            }
          }
        }
      }

      await userRepository.save(user);

      // Получаем обновленного пользователя с связями
      const updatedUser = await userRepository.findOne({
        where: { id: userId },
        relations: ['managedClub', 'managedClubs', 'managedClubs.club', 'ownedClubs'],
      });

      res.json({
        message: 'Пользователь успешно обновлен',
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          phone: updatedUser!.phone,
          role: updatedUser!.role,
          isValidated: updatedUser!.isValidated,
          managedClubId: updatedUser!.managedClubId,
          managedClub: updatedUser!.managedClub,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Только супер-администратор может удалять пользователей
      if (req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав доступа', 403);
      }

      const userId = parseInt(req.params.id);

      if (!userId || isNaN(userId)) {
        throw new AppError('Неверный ID пользователя', 400);
      }

      // Нельзя удалить самого себя
      if (userId === req.userId) {
        throw new AppError('Нельзя удалить самого себя', 400);
      }

      const userRepository = AppDataSource.getRepository(User);

      // Находим пользователя
      const user = await userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      // Нельзя удалить другого супер-администратора
      if (user.role === UserRole.SUPER_ADMIN) {
        throw new AppError('Нельзя удалить супер-администратора', 400);
      }

      await userRepository.remove(user);

      res.json({ message: 'Пользователь успешно удален' });
    } catch (error) {
      next(error);
    }
  }
}

