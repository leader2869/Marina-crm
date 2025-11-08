import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/auth';
import { UserRole } from '../../types';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, firstName, lastName, phone, role } = req.body;

      if (!email || !password || !firstName || !lastName) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({ where: { email } });

      if (existingUser) {
        throw new AppError('Пользователь с таким email уже существует', 400);
      }

      const hashedPassword = await hashPassword(password);
      
      // Валидация роли - разрешаем только vessel_owner или club_owner при регистрации
      let userRole: UserRole;
      if (role === UserRole.VESSEL_OWNER || role === UserRole.CLUB_OWNER) {
        userRole = role as UserRole;
      } else {
        throw new AppError('Неверная роль. Выберите: vessel_owner или club_owner', 400);
      }

      const user = userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: userRole,
        emailVerified: false,
      });

      await userRepository.save(user);

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        message: 'Регистрация успешна',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email и пароль обязательны', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ where: { email } });

      if (!user || !user.isActive) {
        throw new AppError('Неверный email или пароль', 401);
      }

      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        throw new AppError('Неверный email или пароль', 401);
      }

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        message: 'Вход выполнен успешно',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.userId },
        relations: ['ownedClubs', 'vessels', 'managedClub'],
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        ownedClubs: user.ownedClubs,
        vessels: user.vessels,
        managedClub: user.managedClub,
        createdAt: user.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }
}

