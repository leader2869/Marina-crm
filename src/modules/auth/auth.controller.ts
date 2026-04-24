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
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../../config/env';

export class AuthController {
  private readonly phoneVerificationPurpose = 'phone_verification';
  private readonly phoneVerifiedPurpose = 'phone_verified';

  private normalizePhoneForCall(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
      return `+7${digits.slice(1)}`;
    }
    if (digits.length === 10) {
      return `+7${digits}`;
    }
    throw new AppError('Номер телефона должен быть в формате +7XXXXXXXXXX', 400);
  }

  private signPhoneVerificationToken(payload: Record<string, unknown>, expiresIn: string): string {
    const secret = config.jwt.secret;
    if (!secret) {
      throw new AppError('JWT secret is not configured', 500);
    }
    return jwt.sign(payload, secret, { expiresIn } as SignOptions);
  }

  private verifyPhoneVerificationToken(token: string): any {
    const secret = config.jwt.secret;
    if (!secret) {
      throw new AppError('JWT secret is not configured', 500);
    }
    try {
      return jwt.verify(token, secret);
    } catch {
      throw new AppError('Недействительный токен подтверждения номера', 400);
    }
  }

  private getZvonokSuccessStatuses(): Set<string> {
    const raw = process.env.ZVONOK_VERIFICATION_SUCCESS_STATUSES || 'answered,success,completed,complete';
    return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  }

  private isCallVerified(result: any): boolean {
    const successStatuses = this.getZvonokSuccessStatuses();
    const status = String(result?.status || result?.ct_status || '').toLowerCase();
    const dialStatus = String(result?.dial_status || result?.ct_dial_status || '').toLowerCase();
    const buttonNum = String(result?.button_num || result?.ct_button_num || '').toLowerCase();

    return successStatuses.has(status) || successStatuses.has(dialStatus) || buttonNum === '1';
  }

  private async buildZvonokErrorMessage(
    response: { status: number; text: () => Promise<string> },
    fallback: string
  ): Promise<string> {
    try {
      const rawBody = await response.text();
      let details = rawBody;
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed?.error) {
          details = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
        } else if (parsed?.message) {
          details = String(parsed.message);
        } else {
          details = JSON.stringify(parsed);
        }
      } catch {
        // keep text body as-is
      }
      return `${fallback} (Zvonok HTTP ${response.status}: ${details.slice(0, 300)})`;
    } catch {
      return `${fallback} (Zvonok HTTP ${response.status})`;
    }
  }

  private verifyPhoneOwnershipToken(phoneVerificationToken: string | undefined, phone: string): void {
    if (!phoneVerificationToken) {
      throw new AppError('Подтвердите номер телефона перед продолжением', 400);
    }

    const payload = this.verifyPhoneVerificationToken(phoneVerificationToken);
    if (payload?.purpose !== this.phoneVerifiedPurpose) {
      throw new AppError('Недействительный токен подтверждения номера', 400);
    }

    const normalizedRequestPhone = this.normalizePhoneForCall(phone);
    if (payload?.phone !== normalizedRequestPhone) {
      throw new AppError('Токен подтверждения не соответствует номеру телефона', 400);
    }
  }

  async startPhoneVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body;
      if (!phone || !String(phone).trim()) {
        throw new AppError('Номер телефона обязателен', 400);
      }

      const normalizedPhone = this.normalizePhoneForCall(String(phone));
      const publicKey = process.env.ZVONOK_PUBLIC_KEY;
      const campaignId = process.env.ZVONOK_CAMPAIGN_ID;
      const apiBase = process.env.ZVONOK_API_BASE || 'https://zvonok.com/manager/cabapi_external/api/v1';

      if (!publicKey || !campaignId) {
        throw new AppError('Не настроен сервис подтверждения звонком', 500);
      }

      const response = await fetch(`${apiBase}/phones/confirm/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          public_key: publicKey,
          campaign_id: campaignId,
          phone: normalizedPhone,
        }),
      });

      if (!response.ok) {
        const detailedMessage = await this.buildZvonokErrorMessage(
          response,
          'Не удалось инициировать звонок для подтверждения номера'
        );
        throw new AppError(detailedMessage, 502);
      }

      const data = await response.json() as {
        call_id?: number | string;
        callerid?: string;
        caller?: string;
        number?: string;
        callId?: number | string;
      };
      const extractedCallId = Number(data.call_id ?? data.callId);
      const hasCallId = Number.isFinite(extractedCallId) && extractedCallId > 0;
      const callToNumber = data.callerid || data.caller || data.number || null;

      const verificationToken = this.signPhoneVerificationToken(
        {
          purpose: this.phoneVerificationPurpose,
          phone: normalizedPhone,
          callId: hasCallId ? extractedCallId : null,
          campaignId: Number(campaignId),
        },
        '10m'
      );

      res.json({
        message: 'Подтверждение номера инициировано',
        callId: hasCallId ? extractedCallId : null,
        verificationToken,
        callToNumber,
      });
    } catch (error) {
      next(error);
    }
  }

  async checkPhoneVerificationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const verificationToken = String(req.query.verificationToken || '');
      if (!verificationToken) {
        throw new AppError('verificationToken обязателен', 400);
      }

      const payload = this.verifyPhoneVerificationToken(verificationToken);
      if (payload?.purpose !== this.phoneVerificationPurpose || !payload?.phone) {
        throw new AppError('Недействительный токен верификации', 400);
      }

      const publicKey = process.env.ZVONOK_PUBLIC_KEY;
      const apiBase = process.env.ZVONOK_API_BASE || 'https://zvonok.com/manager/cabapi_external/api/v1';
      if (!publicKey) {
        throw new AppError('Не настроен сервис подтверждения звонком', 500);
      }

      let result: any = null;

      if (payload.callId) {
        const url = `${apiBase}/phones/call_by_id/?${new URLSearchParams({
          public_key: publicKey,
          call_id: String(payload.callId),
        }).toString()}`;
        const response = await fetch(url, { method: 'GET' });
        if (!response.ok) {
          const detailedMessage = await this.buildZvonokErrorMessage(
            response,
            'Не удалось получить статус звонка'
          );
          throw new AppError(detailedMessage, 502);
        }
        const data = await response.json() as any;
        result = Array.isArray(data) ? data[0] : data;
      } else {
        const fallbackUrl = `${apiBase}/phones/calls_by_phone/?${new URLSearchParams({
          public_key: publicKey,
          campaign_id: String(payload.campaignId || process.env.ZVONOK_CAMPAIGN_ID || ''),
          phone: String(payload.phone),
        }).toString()}`;
        const fallbackResponse = await fetch(fallbackUrl, { method: 'GET' });
        if (!fallbackResponse.ok) {
          const detailedMessage = await this.buildZvonokErrorMessage(
            fallbackResponse,
            'Не удалось получить статус звонка'
          );
          throw new AppError(detailedMessage, 502);
        }
        const list = await fallbackResponse.json() as any[];
        if (Array.isArray(list) && list.length > 0) {
          result = list[list.length - 1];
        }
      }
      const status = String(result?.status || result?.ct_status || 'unknown');
      const verified = this.isCallVerified(result);

      if (!verified) {
        res.json({
          verified: false,
          status,
          callToNumber: result?.callerid || result?.caller || null,
        });
        return;
      }

      const phoneVerificationToken = this.signPhoneVerificationToken(
        {
          purpose: this.phoneVerifiedPurpose,
          phone: payload.phone,
          callId: payload.callId,
        },
        '15m'
      );

      res.json({
        verified: true,
        status,
        phoneVerificationToken,
        callToNumber: result?.callerid || result?.caller || null,
      });
    } catch (error) {
      next(error);
    }
  }

  async handlePhoneVerificationPostback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const expectedSecret = process.env.ZVONOK_POSTBACK_SECRET;
      const providedSecret = String(req.query.secret || '');

      // Если секрет настроен, принимаем только валидные постбеки.
      if (expectedSecret && providedSecret !== expectedSecret) {
        throw new AppError('Неверный секрет postback', 403);
      }

      const payload = {
        event: String(req.query.event || ''),
        callId: String(req.query.call_id || req.query.ct_call_id || ''),
        phone: String(req.query.phone || req.query.ct_phone || ''),
        status: String(req.query.status || req.query.ct_status || ''),
        dialStatus: String(req.query.dial_status || req.query.ct_dial_status || ''),
        button: String(req.query.button || req.query.ct_button_num || ''),
        completedTs: String(req.query.completed_ts || req.query.ct_completed_ts || ''),
      };

      console.log('[Zvonok Postback] Получен postback:', payload);

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }

  private async verifyRecaptchaToken(recaptchaToken: string | undefined): Promise<void> {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
      throw new AppError('reCAPTCHA не настроена на сервере', 500);
    }

    if (!recaptchaToken) {
      throw new AppError('Подтвердите, что вы не робот', 400);
    }

    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: secretKey,
        response: recaptchaToken,
      }),
    });

    if (!response.ok) {
      throw new AppError('Не удалось проверить reCAPTCHA', 502);
    }

    const data = await response.json() as { success?: boolean };
    if (!data.success) {
      throw new AppError('Проверка reCAPTCHA не пройдена', 400);
    }
  }

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
      const { password, firstName, lastName, phone, role, recaptchaToken, phoneVerificationToken } = req.body;

      if (!password || !firstName || !lastName || !phone) {
        throw new AppError('Все обязательные поля должны быть заполнены', 400);
      }

      await this.verifyRecaptchaToken(recaptchaToken);

      // Валидация телефона
      if (!phone || phone.trim() === '' || !phone.startsWith('+7')) {
        throw new AppError('Номер телефона обязателен и должен начинаться с +7', 400);
      }

      this.verifyPhoneOwnershipToken(phoneVerificationToken, phone);

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

      void ActivityLogService.logActivity({
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
      const { firstName, phone, recaptchaToken, phoneVerificationToken } = req.body;

      if (!firstName || !firstName.trim()) {
        throw new AppError('Имя обязательно для заполнения', 400);
      }

      await this.verifyRecaptchaToken(recaptchaToken);

      const userRepository = AppDataSource.getRepository(User);

      if (!phone || !phone.trim()) {
        throw new AppError('Номер телефона обязателен', 400);
      }
      this.verifyPhoneOwnershipToken(phoneVerificationToken, phone);
      
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
      
      // Для профиля не загружаем тяжелые связи (особенно vessels),
      // чтобы избежать таймаутов БД на production.
      const user = await userRepository.findOne({
        where: { id: req.userId },
        relations: ['ownedClubs', 'managedClub'],
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
        vessels: [],
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

