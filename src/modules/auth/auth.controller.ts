import { Request, Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { User } from '../../entities/User';
import { hashPassword, comparePassword } from '../../utils/password';
import { generateToken } from '../../utils/jwt';
import { AppError } from '../../middleware/errorHandler';
import { AuthRequest } from '../../middleware/auth';
import { UserRole } from '../../types';
import { ActivityLogService } from '../../services/activityLog.service';
import { ActivityType, EntityType } from '../../entities/ActivityLog';
import { generateActivityDescription } from '../../utils/activityLogDescription';

export class AuthController {
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

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password, firstName, lastName, phone, role } = req.body;

      if (!password || !firstName || !lastName || !phone) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      // Валидация телефона
      if (!phone || phone.trim() === '' || !phone.startsWith('+7')) {
        throw new AppError('Номер телефона обязателен и должен начинаться с +7', 400);
      }

      // Генерируем email на основе телефона
      // Удаляем все нецифровые символы из телефона для создания уникального email
      const phoneDigits = phone.replace(/\D/g, '');
      const email = `user_${phoneDigits}@marina-crm.com`;

      const userRepository = AppDataSource.getRepository(User);
      const existingUser = await userRepository.findOne({ where: { email } });

      if (existingUser) {
        throw new AppError('Пользователь с таким номером телефона уже существует', 400);
      }

      // Проверяем, нет ли пользователя с таким же телефоном (с нормализацией)
      if (phone && phone.trim()) {
        const normalizedPhone = this.normalizePhone(phone);
        const allUsers = await userRepository.find({ where: { isActive: true } });
        const existingUserByPhone = allUsers.find(u => {
          if (!u.phone) return false;
          const normalizedDb = this.normalizePhone(u.phone);
          return normalizedDb === normalizedPhone;
        });
        if (existingUserByPhone) {
          throw new AppError('Пользователь с таким номером телефона уже существует', 400);
        }
      }

      const hashedPassword = await hashPassword(password);
      
      // Валидация роли - разрешаем vessel_owner, club_owner, agent, captain, mechanic при регистрации
      // Проверяем как строковые значения, так и enum значения
      let userRole: UserRole;
      const roleString = String(role).toLowerCase();
      
      if (role === UserRole.VESSEL_OWNER || roleString === 'vessel_owner' || roleString === UserRole.VESSEL_OWNER) {
        userRole = UserRole.VESSEL_OWNER;
      } else if (role === UserRole.CLUB_OWNER || roleString === 'club_owner' || roleString === UserRole.CLUB_OWNER) {
        // Для CLUB_OWNER присваиваем роль PENDING_VALIDATION до валидации
        userRole = UserRole.PENDING_VALIDATION;
      } else if (role === UserRole.AGENT || roleString === 'agent' || roleString === UserRole.AGENT) {
        userRole = UserRole.AGENT;
      } else if (role === UserRole.CAPTAIN || roleString === 'captain' || roleString === UserRole.CAPTAIN) {
        userRole = UserRole.CAPTAIN;
      } else if (role === UserRole.MECHANIC || roleString === 'mechanic' || roleString === UserRole.MECHANIC) {
        userRole = UserRole.MECHANIC;
      } else {
        throw new AppError('Неверная роль. Выберите: vessel_owner, club_owner, agent, captain или mechanic', 400);
      }

      // Для PENDING_VALIDATION isValidated = false, для остальных = true
      const isValidated = userRole !== UserRole.PENDING_VALIDATION;

      const user = userRepository.create({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: userRole,
        emailVerified: false,
        isValidated: isValidated,
      });

      await userRepository.save(user);

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Формируем сообщение в зависимости от роли
      let message = 'Регистрация успешна';
      if (userRole === UserRole.PENDING_VALIDATION) {
        message = 'Регистрация успешна. Ваш аккаунт ожидает валидации суперадминистратором. Вы получите уведомление после одобрения.';
      }

      res.status(201).json({
        message,
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isValidated: user.isValidated,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { emailOrPhone, password } = req.body;

      console.log(`[Login] Попытка входа: emailOrPhone=${emailOrPhone?.substring(0, 10)}...`);

      if (!emailOrPhone || !password) {
        console.log(`[Login] ❌ Отсутствуют обязательные поля: emailOrPhone=${!!emailOrPhone}, password=${!!password}`);
        throw new AppError('Email/телефон и пароль обязательны', 400);
      }

      // Проверяем инициализацию базы данных
      if (!AppDataSource.isInitialized) {
        console.error('[Auth Login] База данных не инициализирована');
        throw new AppError('База данных не подключена', 503);
      }

      let userRepository;
      try {
        userRepository = AppDataSource.getRepository(User);
      } catch (repoError: any) {
        console.error('[Auth Login] Ошибка при получении репозитория User:', {
          message: repoError.message,
          stack: repoError.stack,
          name: repoError.name
        });
        throw new AppError(`Ошибка доступа к базе данных: ${repoError.message}`, 500);
      }
      
      // Определяем, что введено: email или телефон
      // Проверяем, содержит ли строка символ @ (это email) или начинается с цифр/+
      const isPhone = !emailOrPhone.includes('@') && (
        emailOrPhone.includes('+') || 
        /^[78]\d/.test(emailOrPhone.replace(/\D/g, '')) ||
        /^\d/.test(emailOrPhone.replace(/\D/g, ''))
      );
      
      let user: User | null = null;
      
      if (isPhone) {
        // Ищем по телефону
        // Нормализуем введенный телефон: убираем все нецифровые символы
        let normalizedInput = emailOrPhone.replace(/\D/g, '');
        
        // Если начинается с 8, заменяем на 7
        if (normalizedInput.startsWith('8')) {
          normalizedInput = '7' + normalizedInput.substring(1);
        }
        // Если не начинается с 7, добавляем 7
        if (!normalizedInput.startsWith('7')) {
          normalizedInput = '7' + normalizedInput;
        }
        
        // Получаем последние 10 цифр для сравнения
        const last10Digits = normalizedInput.slice(-10);
        
        // Ищем пользователя по нормализованному номеру телефона
        // Используем SQL функцию для нормализации телефона в базе
        let users;
        try {
          users = await userRepository
            .createQueryBuilder('user')
            .where('user.isActive = :isActive', { isActive: true })
            .andWhere('user.phone IS NOT NULL')
            .getMany();
        } catch (dbError: any) {
          console.error('[Auth Login] Ошибка при поиске пользователя по телефону:', {
            message: dbError.message,
            stack: dbError.stack,
            code: dbError.code,
            detail: dbError.detail
          });
          throw new AppError(`Ошибка при поиске пользователя: ${dbError.message}`, 500);
        }
        
        // Фильтруем в памяти по нормализованному номеру
        user = users.find(u => {
          if (!u.phone) return false;
          let normalizedDb = u.phone.replace(/\D/g, '');
          if (normalizedDb.startsWith('8')) {
            normalizedDb = '7' + normalizedDb.substring(1);
          }
          if (!normalizedDb.startsWith('7')) {
            normalizedDb = '7' + normalizedDb;
          }
          return normalizedDb.slice(-10) === last10Digits;
        }) || null;
      } else {
        // Ищем по email
        console.log(`[Login] Поиск пользователя по email: ${emailOrPhone}`);
        try {
          user = await userRepository.findOne({ 
            where: { email: emailOrPhone, isActive: true } 
          });
        } catch (dbError: any) {
          console.error('[Auth Login] Ошибка при поиске пользователя по email:', {
            message: dbError.message,
            stack: dbError.stack,
            code: dbError.code,
            detail: dbError.detail
          });
          throw new AppError(`Ошибка при поиске пользователя: ${dbError.message}`, 500);
        }
      }

      if (!user) {
        console.log(`[Login] ❌ Пользователь не найден: ${emailOrPhone}`);
        throw new AppError('Неверный email/телефон или пароль', 401);
      }

      console.log(`[Login] Пользователь найден: ${user.email}, isActive=${user.isActive}, role=${user.role}`);

      if (!user.isActive) {
        console.log(`[Login] ❌ Пользователь неактивен: ${user.email}`);
        throw new AppError('Неверный email/телефон или пароль', 401);
      }

      console.log(`[Login] Проверка пароля для пользователя: ${user.email}`);
      const isPasswordValid = await comparePassword(password, user.password);

      if (!isPasswordValid) {
        console.log(`[Login] ❌ Неверный пароль для пользователя: ${user.email}`);
        throw new AppError('Неверный email/телефон или пароль', 401);
      }

      console.log(`[Login] ✅ Пароль верный для пользователя: ${user.email}`);

      const token = generateToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Логируем вход в систему
      const userName = `${user.firstName} ${user.lastName}`.trim();
      const logDescription = generateActivityDescription(
        ActivityType.LOGIN,
        EntityType.USER,
        user.id,
        userName,
        null,
        null,
        null
      );

      await ActivityLogService.logActivity({
        activityType: ActivityType.LOGIN,
        entityType: EntityType.USER,
        entityId: user.id,
        userId: user.id,
        description: logDescription,
        oldValues: null,
        newValues: null,
        ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
        userAgent: req.headers['user-agent'] || null,
      }).catch((error) => {
        console.error('Ошибка логирования входа:', error);
        // Не прерываем процесс входа, если логирование не удалось
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
          isValidated: user.isValidated,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async loginAsGuest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { firstName, phone } = req.body;

      if (!firstName || !firstName.trim()) {
        throw new AppError('Имя обязательно для заполнения', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      
      // Проверяем уникальность телефона, если он указан
      if (phone && phone.trim()) {
        const normalizedPhone = this.normalizePhone(phone);
        const allUsers = await userRepository.find({ where: { isActive: true } });
        const existingUserByPhone = allUsers.find(u => {
          if (!u.phone) return false;
          const normalizedDb = this.normalizePhone(u.phone);
          return normalizedDb === normalizedPhone;
        });
        if (existingUserByPhone) {
          throw new AppError('Пользователь с таким номером телефона уже существует', 400);
        }
      }
      
      // Создаем временного пользователя с ролью GUEST
      // Используем уникальный email на основе timestamp
      const guestEmail = `guest_${Date.now()}@marina-crm.com`;
      const hashedPassword = await hashPassword('guest_password_' + Date.now());
      
      const guestUser = userRepository.create({
        email: guestEmail,
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: '',
        phone: phone || null,
        role: UserRole.GUEST,
        emailVerified: false,
        isActive: true,
      });

      await userRepository.save(guestUser);

      const token = generateToken({
        userId: guestUser.id,
        email: guestUser.email,
        role: guestUser.role,
      });

      res.json({
        message: 'Вход как гость выполнен успешно',
        token,
        user: {
          id: guestUser.id,
          email: guestUser.email,
          firstName: guestUser.firstName,
          lastName: guestUser.lastName,
          role: guestUser.role,
          isValidated: guestUser.isValidated,
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

      // Проверяем инициализацию базы данных
      if (!AppDataSource.isInitialized) {
        console.error('[Auth] База данных не инициализирована');
        throw new AppError('База данных не подключена', 503);
      }

      let userRepository;
      try {
        userRepository = AppDataSource.getRepository(User);
      } catch (repoError: any) {
        console.error('[Auth getProfile] Ошибка при получении репозитория User:', {
          message: repoError.message,
          stack: repoError.stack,
          name: repoError.name
        });
        throw new AppError(`Ошибка доступа к базе данных: ${repoError.message}`, 500);
      }
      
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
        isValidated: user.isValidated,
        ownedClubs: user.ownedClubs,
        vessels: user.vessels,
        managedClub: user.managedClub,
        createdAt: user.createdAt,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { firstName, lastName, email, avatar } = req.body;

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.userId },
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      // Обновление имени
      if (firstName !== undefined) {
        user.firstName = firstName;
      }
      if (lastName !== undefined) {
        user.lastName = lastName;
      }

      // Обновление email с проверкой уникальности
      if (email !== undefined && email !== user.email) {
        const existingUser = await userRepository.findOne({ where: { email } });
        if (existingUser) {
          throw new AppError('Пользователь с таким email уже существует', 400);
        }
        user.email = email;
      }

      // Обновление аватара (может быть base64 строка или URL)
      if (avatar !== undefined) {
        user.avatar = avatar || null;
      }

      await userRepository.save(user);

      // Получаем обновленного пользователя с связями
      const updatedUser = await userRepository.findOne({
        where: { id: req.userId },
        relations: ['ownedClubs', 'vessels', 'managedClub'],
      });

      res.json({
        message: 'Профиль успешно обновлен',
        user: {
          id: updatedUser!.id,
          email: updatedUser!.email,
          firstName: updatedUser!.firstName,
          lastName: updatedUser!.lastName,
          phone: updatedUser!.phone,
          role: updatedUser!.role,
          avatar: updatedUser!.avatar || null,
          isValidated: updatedUser!.isValidated,
          ownedClubs: updatedUser!.ownedClubs,
          vessels: updatedUser!.vessels,
          managedClub: updatedUser!.managedClub,
          createdAt: updatedUser!.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        throw new AppError('Текущий и новый пароль обязательны', 400);
      }

      if (newPassword.length < 6) {
        throw new AppError('Новый пароль должен содержать минимум 6 символов', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.userId },
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      // Проверяем текущий пароль
      const isPasswordValid = await comparePassword(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new AppError('Неверный текущий пароль', 400);
      }

      // Устанавливаем новый пароль
      user.password = await hashPassword(newPassword);
      await userRepository.save(user);

      res.json({
        message: 'Пароль успешно изменен',
      });
    } catch (error) {
      next(error);
    }
  }

  async requestPhoneChange(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { newPhone } = req.body;

      if (!newPhone || !newPhone.trim()) {
        throw new AppError('Новый номер телефона обязателен', 400);
      }

      // Валидация телефона
      if (!newPhone.startsWith('+7')) {
        throw new AppError('Номер телефона должен начинаться с +7', 400);
      }

      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({
        where: { id: req.userId },
      });

      if (!user) {
        throw new AppError('Пользователь не найден', 404);
      }

      // Проверяем, не используется ли этот номер другим пользователем
      const normalizedPhone = this.normalizePhone(newPhone);
      const allUsers = await userRepository.find({ where: { isActive: true } });
      const existingUserByPhone = allUsers.find(u => {
        if (!u.phone || u.id === user.id) return false;
        const normalizedDb = this.normalizePhone(u.phone);
        return normalizedDb === normalizedPhone;
      });

      if (existingUserByPhone) {
        throw new AppError('Пользователь с таким номером телефона уже существует', 400);
      }

      // Сохраняем запрос на изменение телефона (пока не подтвержден суперадминистратором)
      // Можно использовать отдельную таблицу для запросов или добавить поле в User
      // Для простоты, сохраняем в поле phonePendingValidation
      // Но в текущей схеме User нет такого поля, поэтому просто сохраняем запрос
      // В реальном приложении нужно создать таблицу PhoneChangeRequests

      res.json({
        message: 'Запрос на изменение номера телефона отправлен на валидацию суперадминистратору',
        newPhone,
      });
    } catch (error) {
      next(error);
    }
  }
}

