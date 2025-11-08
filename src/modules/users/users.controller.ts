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

export class UsersController {
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

      // Обновление телефона
      if (phone !== undefined) {
        user.phone = phone || null;
      }

      // Обновление роли
      if (role) {
        // Валидация роли
        if (!Object.values(UserRole).includes(role)) {
          throw new AppError('Неверная роль', 400);
        }
        user.role = role as UserRole;
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

