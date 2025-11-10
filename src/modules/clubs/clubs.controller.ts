import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { In } from 'typeorm';
import { Club } from '../../entities/Club';
import { Berth } from '../../entities/Berth';
import { Booking } from '../../entities/Booking';
import { Income } from '../../entities/Income';
import { Expense } from '../../entities/Expense';
import { Budget } from '../../entities/Budget';
import { UserClub } from '../../entities/UserClub';
import { User } from '../../entities/User';
import { Payment } from '../../entities/Payment';
import { Tariff } from '../../entities/Tariff';
import { BookingRule } from '../../entities/BookingRule';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { UserRole, BookingStatus } from '../../types';

export class ClubsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );
      const { location, minPrice, maxPrice, available, showHidden } = req.query;

      const clubRepository = AppDataSource.getRepository(Club);
      const queryBuilder = clubRepository
        .createQueryBuilder('club')
        .leftJoinAndSelect('club.owner', 'owner')
        .leftJoinAndSelect('club.berths', 'berths');
      
      // Если суперадмин запрашивает скрытые клубы, показываем все, иначе только активные
      // Проверяем userRole (может быть undefined, если запрос без аутентификации)
      const isSuperAdmin = req.userRole === UserRole.SUPER_ADMIN;
      const isClubOwner = req.userRole === UserRole.CLUB_OWNER;
      
      // Для владельца клуба показываем только его клубы (включая невалидированные)
      if (isClubOwner && req.userId) {
        queryBuilder.where('club.ownerId = :ownerId', { ownerId: req.userId });
        console.log('Владелец клуба запросил свои клубы, userId:', req.userId);
      } else if (showHidden === 'true' && isSuperAdmin) {
        // Суперадмин может видеть все клубы, включая скрытые и невалидированные
        console.log('Суперадмин запросил скрытые клубы, userRole:', req.userRole);
      } else {
        // Показываем только активные И валидированные И отправленные на валидацию клубы для всех остальных
        queryBuilder.where('club.isActive = :isActive AND club.isValidated = :isValidated AND club.isSubmittedForValidation = :isSubmittedForValidation', { 
          isActive: true, 
          isValidated: true,
          isSubmittedForValidation: true
        });
        console.log('Фильтр по активным и валидированным клубам применен, showHidden:', showHidden, 'isSuperAdmin:', isSuperAdmin);
      }

      // Фильтры
      if (location) {
        queryBuilder.andWhere(
          '(club.address ILIKE :location OR club.name ILIKE :location)',
          { location: `%${location}%` }
        );
      }

      if (minPrice) {
        queryBuilder.andWhere('club.basePrice >= :minPrice', {
          minPrice: parseFloat(minPrice as string),
        });
      }

      if (maxPrice) {
        queryBuilder.andWhere('club.basePrice <= :maxPrice', {
          maxPrice: parseFloat(maxPrice as string),
        });
      }

      if (available === 'true') {
        queryBuilder.andWhere('club.totalBerths > 0');
      }

      const [clubs, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      // Если владелец клуба запросил свои клубы, возвращаем только его клубы
      // Если суперадмин запросил скрытые клубы, возвращаем все, иначе фильтруем только активные
      let filteredClubs = clubs;
      
      if (isClubOwner && req.userId) {
        // Для владельца клуба показываем только его клубы (включая скрытые и невалидированные)
        filteredClubs = clubs.filter((club) => club.ownerId === req.userId);
      } else if (showHidden !== 'true' || !isSuperAdmin) {
        // Дополнительная фильтрация на случай, если фильтр не сработал
        // Показываем только активные И валидированные И отправленные на валидацию клубы
        filteredClubs = clubs.filter((club) => 
          club.isActive === true && 
          club.isValidated === true && 
          club.isSubmittedForValidation === true
        );
      }
      
      // Отладочная информация
      console.log('Клубы загружены из БД:', clubs.length, 'После фильтрации:', filteredClubs.length);
      console.log('Параметры запроса - showHidden:', showHidden, 'isSuperAdmin:', isSuperAdmin, 'userRole:', req.userRole);
      
      if (showHidden === 'true' && isSuperAdmin) {
        const hiddenCount = clubs.filter((club) => !club.isActive).length;
        console.log('Скрытых клубов:', hiddenCount);
      }

      res.json(createPaginatedResponse(filteredClubs, filteredClubs.length, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'managers'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Гость и PENDING_VALIDATION могут видеть только активные И валидированные клубы
      const isGuest = !req.userId || req.userRole === UserRole.GUEST;
      const isPendingValidation = req.userRole === UserRole.PENDING_VALIDATION;
      const isSuperAdmin = req.userRole === UserRole.SUPER_ADMIN;
      const isClubOwner = req.userRole === UserRole.CLUB_OWNER;
      
      // Проверяем доступ: для гостя и PENDING_VALIDATION - только активные, валидированные и отправленные на валидацию
      // Для владельца клуба - может видеть свои клубы (включая неотправленные на валидацию)
      // Для суперадмина - может видеть все клубы
      if ((isGuest || isPendingValidation) && (!club.isActive || !club.isValidated || !club.isSubmittedForValidation)) {
        throw new AppError('Яхт-клуб не найден или неактивен', 404);
      }
      
      // Владелец клуба может видеть только свои клубы
      if (isClubOwner && req.userId && club.ownerId !== req.userId) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      
      // Для гостя показываем только доступные места (isAvailable = true), но включая забронированные
      // Для PENDING_VALIDATION и других ролей показываем все места (включая занятые)
      let berthsQuery = berthRepository
        .createQueryBuilder('berth')
        .leftJoinAndSelect('berth.tariffBerths', 'tariffBerths')
        .leftJoinAndSelect('tariffBerths.tariff', 'tariff')
        .where('berth.clubId = :clubId', { clubId: club.id });
      
      if (isGuest) {
        berthsQuery = berthsQuery.andWhere('berth.isAvailable = :isAvailable', { isAvailable: true });
      }
      // Для PENDING_VALIDATION показываем все места (isAvailable = true), как и для других ролей
      
      const berths = await berthsQuery
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Фильтруем тарифы по сезону клуба, если сезон указан
      if (club.season) {
        berths.forEach(berth => {
          if (berth.tariffBerths) {
            berth.tariffBerths = berth.tariffBerths.filter(tb => 
              tb.tariff && (tb.tariff.season === club.season || !tb.tariff.season)
            )
          }
        })
      }

      // Добавляем отсортированные места к клубу
      club.berths = berths;

      res.json(club);
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      // Проверяем, что пользователь не имеет роль PENDING_VALIDATION
      if (req.userRole === UserRole.PENDING_VALIDATION) {
        throw new AppError('Ваш аккаунт ожидает валидации суперадминистратором. Вы не можете добавлять клубы до завершения валидации.', 403);
      }

      const {
        name,
        description,
        address,
        latitude,
        longitude,
        phone,
        email,
        website,
        totalBerths,
        minRentalPeriod,
        maxRentalPeriod,
        basePrice,
        minPricePerMonth,
        season,
        rentalMonths,
      } = req.body;

      if (!name || !address || !latitude || !longitude || !season) {
        throw new AppError('Все обязательные поля должны быть заполнены, включая сезон', 400);
      }

      const clubRepository = AppDataSource.getRepository(Club);
      const club = clubRepository.create({
        name,
        description,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        phone,
        email,
        website,
        totalBerths: totalBerths || 0,
        minRentalPeriod: minRentalPeriod || 1,
        maxRentalPeriod: maxRentalPeriod || 365,
        basePrice: basePrice || 0,
        minPricePerMonth: minPricePerMonth ? parseFloat(minPricePerMonth) : null,
        season: season ? parseInt(season) : null,
        rentalMonths: rentalMonths && Array.isArray(rentalMonths) && rentalMonths.length > 0 
          ? (() => {
              // Валидация месяцев аренды
              const invalidMonths = rentalMonths.filter((m: number) => m < 1 || m > 12);
              if (invalidMonths.length > 0) {
                throw new AppError('Месяца должны быть в диапазоне от 1 до 12', 400);
              }
              return rentalMonths;
            })()
          : null,
        isValidated: false, // Новые клубы не валидированы
        isSubmittedForValidation: false, // Новые клубы еще не отправлены на валидацию
        ownerId: req.userId,
      });

      await clubRepository.save(club);

      // Создаем места
      if (totalBerths > 0) {
        const berthRepository = AppDataSource.getRepository(Berth);
        const berths = [];

        for (let i = 1; i <= totalBerths; i++) {
          const berth = berthRepository.create({
            number: `Место ${i}`,
            length: 20, // значение по умолчанию
            width: 5,
            pricePerDay: basePrice,
            clubId: club.id,
          });
          berths.push(berth);
        }

        await berthRepository.save(berths);
      }

      const savedClub = await clubRepository.findOne({
        where: { id: club.id },
        relations: ['owner'],
      });

      if (!savedClub) {
        throw new AppError('Ошибка при создании клуба', 500);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Добавляем отсортированные места к клубу
      savedClub.berths = berths;

      res.status(201).json(savedClub);
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { id } = req.params;
      const {
        name,
        description,
        address,
        latitude,
        longitude,
        phone,
        email,
        website,
        totalBerths,
        minRentalPeriod,
        maxRentalPeriod,
        basePrice,
        minPricePerMonth,
        season,
        rentalMonths,
        bookingRulesText,
      } = req.body;

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['owner', 'berths'],
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - владелец клуба может редактировать свой клуб
      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN &&
        req.userRole !== UserRole.ADMIN
      ) {
        throw new AppError('Недостаточно прав для редактирования', 403);
      }

      // Обновляем поля клуба
      if (name !== undefined) club.name = name;
      if (description !== undefined) club.description = description;
      if (address !== undefined) club.address = address;
      if (latitude !== undefined) club.latitude = parseFloat(latitude as string);
      if (longitude !== undefined) club.longitude = parseFloat(longitude as string);
      if (phone !== undefined) club.phone = phone;
      if (email !== undefined) club.email = email;
      if (website !== undefined) club.website = website;
      if (minRentalPeriod !== undefined) club.minRentalPeriod = parseInt(minRentalPeriod as string);
      if (maxRentalPeriod !== undefined) club.maxRentalPeriod = parseInt(maxRentalPeriod as string);
      if (basePrice !== undefined) club.basePrice = parseFloat(basePrice as string);
      if (minPricePerMonth !== undefined) club.minPricePerMonth = minPricePerMonth ? parseFloat(minPricePerMonth as string) : null;
      if (season !== undefined) club.season = season ? parseInt(season as string) : null;
      if (rentalMonths !== undefined) {
        // Валидация месяцев аренды
        if (rentalMonths !== null && (!Array.isArray(rentalMonths) || rentalMonths.length === 0)) {
          club.rentalMonths = null;
        } else if (Array.isArray(rentalMonths)) {
          // Проверяем, что все месяцы в диапазоне 1-12
          const invalidMonths = rentalMonths.filter((m: number) => m < 1 || m > 12);
          if (invalidMonths.length > 0) {
            throw new AppError('Месяца должны быть в диапазоне от 1 до 12', 400);
          }
          club.rentalMonths = rentalMonths;
        } else {
          club.rentalMonths = null;
        }
      }
      if (bookingRulesText !== undefined) {
        club.bookingRulesText = bookingRulesText || null;
      }
      // Только суперадмин может изменять isValidated и rejectionComment
      if (req.userRole === UserRole.SUPER_ADMIN && req.body.isValidated !== undefined) {
        club.isValidated = req.body.isValidated === true || req.body.isValidated === 'true';
      }
      if (req.userRole === UserRole.SUPER_ADMIN && req.body.rejectionComment !== undefined) {
        club.rejectionComment = req.body.rejectionComment || null;
      }
      // Владелец клуба может отправлять клуб на валидацию
      if (req.userRole === UserRole.CLUB_OWNER && req.userId === club.ownerId && req.body.isSubmittedForValidation !== undefined) {
        club.isSubmittedForValidation = req.body.isSubmittedForValidation === true || req.body.isSubmittedForValidation === 'true';
        // При отправке на валидацию сбрасываем isValidated и делаем клуб активным
        if (club.isSubmittedForValidation) {
          club.isValidated = false;
          club.isActive = true;
          // Сбрасываем комментарий об отказе при повторной отправке
          if (req.body.rejectionComment !== undefined) {
            club.rejectionComment = null;
          }
        }
      }
      // Владелец клуба и суперадмин могут снимать клуб с публикации (устанавливать isActive = false)
      if ((req.userRole === UserRole.SUPER_ADMIN || (req.userRole === UserRole.CLUB_OWNER && req.userId === club.ownerId)) && req.body.isActive !== undefined) {
        club.isActive = req.body.isActive === true || req.body.isActive === 'true';
      }

      // totalBerths теперь автоматически подсчитывается на основе добавленных мест
      // Не обрабатываем изменение totalBerths при редактировании клуба

      await clubRepository.save(club);

      // Получаем обновленный клуб с связями
      const updatedClub = await clubRepository.findOne({
        where: { id: club.id },
        relations: ['owner'],
      });

      if (!updatedClub) {
        throw new AppError('Ошибка при обновлении клуба', 500);
      }

      // Загружаем места с сортировкой по номеру места
      // Сначала места, начинающиеся с текста (алфавитно), потом с числа (по возрастанию)
      const berthRepository = AppDataSource.getRepository(Berth);
      const berths = await berthRepository
        .createQueryBuilder('berth')
        .where('berth.clubId = :clubId', { clubId: club.id })
        .orderBy(
          `CASE WHEN berth.number ~ '^[^0-9]' THEN 0 ELSE 1 END`,
          'ASC'
        )
        .addOrderBy(
          `CASE WHEN berth.number ~ '^[0-9]' THEN CAST(SUBSTRING(berth.number FROM '^([0-9]+)') AS INTEGER) ELSE 0 END`,
          'ASC'
        )
        .addOrderBy('berth.number', 'ASC')
        .getMany();

      // Добавляем отсортированные места к клубу
      updatedClub.berths = berths;

      res.json(updatedClub);
    } catch (error) {
      next(error);
    }
  }

  async hide(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('Hide route called, params:', req.params);
      console.log('Hide route called, body:', req.body);
      const { id } = req.params;
      const clubId = parseInt(id);
      
      if (isNaN(clubId)) {
        throw new AppError('Неверный ID клуба', 400);
      }
      
      console.log('Hiding club with ID:', clubId);

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: clubId },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - супер-администратор или владелец клуба может скрывать клубы
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }
      
      const isSuperAdmin = req.userRole === UserRole.SUPER_ADMIN || req.userRole === 'super_admin';
      const isClubOwner = req.userRole === UserRole.CLUB_OWNER || req.userRole === 'club_owner';
      // Сравниваем с учетом возможных различий в типах (число vs строка)
      const isOwnerOfClub = club.ownerId === req.userId || club.ownerId === parseInt(req.userId.toString()) || parseInt(club.ownerId.toString()) === req.userId;
      
      console.log('Hide club - userRole:', req.userRole, 'userId:', req.userId, 'club.ownerId:', club.ownerId);
      console.log('Hide club - isSuperAdmin:', isSuperAdmin, 'isClubOwner:', isClubOwner, 'isOwnerOfClub:', isOwnerOfClub);
      
      if (!isSuperAdmin && (!isClubOwner || !isOwnerOfClub)) {
        throw new AppError('Недостаточно прав для скрытия клуба', 403);
      }

      // Используем транзакцию для атомарности операций
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const userClubRepository = queryRunner.manager.getRepository(UserClub);
        const userRepository = queryRunner.manager.getRepository(User);
        const clubRepositoryTransaction = queryRunner.manager.getRepository(Club);

        // Загружаем клуб в транзакции
        const clubInTransaction = await clubRepositoryTransaction.findOne({
          where: { id: clubId },
        });

        if (!clubInTransaction) {
          throw new AppError('Яхт-клуб не найден в транзакции', 404);
        }

        // При снятии с публикации (скрытии) клуб становится неактивным и недоступным для бронирования
        // Все связи остаются нетронутыми (user_clubs и managedClubId)
        // Клуб просто становится недоступным для бронирования

        // Устанавливаем клуб как неактивный и сбрасываем статус публикации
        clubInTransaction.isActive = false;
        clubInTransaction.isValidated = false;
        clubInTransaction.isSubmittedForValidation = false;
        const savedClub = await clubRepositoryTransaction.save(clubInTransaction);
        console.log('Клуб скрыт (isActive = false), ID:', savedClub.id, 'isActive:', savedClub.isActive);
        
        // Проверяем, что клуб действительно сохранен как неактивный
        const verifyClub = await clubRepositoryTransaction.findOne({
          where: { id: clubId },
          select: ['id', 'name', 'isActive'],
        });
        console.log('Проверка сохранения клуба:', verifyClub);

        // Коммитим транзакцию
        await queryRunner.commitTransaction();
        res.json({ message: 'Яхт-клуб успешно снят с публикации. Клуб попал в скрытые яхт-клубы и стал недоступным для бронирования. Все связи остались.' });
      } catch (error: any) {
        // Откатываем транзакцию в случае ошибки
        try {
          await queryRunner.rollbackTransaction();
        } catch (rollbackError) {
          console.error('Ошибка при откате транзакции:', rollbackError);
        }

        console.error('Ошибка при скрытии клуба:', error);
        next(error);
      } finally {
        // Освобождаем соединение
        try {
          await queryRunner.release();
        } catch (releaseError) {
          console.error('Ошибка при освобождении соединения:', releaseError);
        }
      }
    } catch (error) {
      next(error);
    }
  }

  async restore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const clubId = parseInt(id);

      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: clubId },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      // Проверка прав доступа - только супер-администратор может восстанавливать клубы
      if (req.userRole !== UserRole.SUPER_ADMIN) {
        throw new AppError('Недостаточно прав для восстановления клуба', 403);
      }

      // Восстанавливаем клуб (делаем активным и восстанавливаем статус публикации)
      // Если клуб был опубликован до скрытия, восстанавливаем статус публикации
      club.isActive = true;
      // Восстанавливаем статус публикации, если клуб был опубликован
      // Проверяем, был ли клуб опубликован (если есть валидация или отправка на валидацию)
      // Если клуб был скрыт через hide, статусы были сброшены, поэтому восстанавливаем их
      if (club.isValidated === false && club.isSubmittedForValidation === false) {
        // Если статусы были сброшены, восстанавливаем их (клуб был опубликован до скрытия)
        club.isSubmittedForValidation = true;
        club.isValidated = true;
      }
      await clubRepository.save(club);
      console.log('Клуб восстановлен (isActive = true), ID:', club.id, 'isValidated:', club.isValidated, 'isSubmittedForValidation:', club.isSubmittedForValidation);

      res.json({ message: 'Яхт-клуб успешно восстановлен и опубликован' });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const clubId = parseInt(id);

      // Проверка прав доступа
      const clubRepository = AppDataSource.getRepository(Club);
      const club = await clubRepository.findOne({
        where: { id: clubId },
      });

      if (!club) {
        throw new AppError('Яхт-клуб не найден', 404);
      }

      if (
        club.ownerId !== req.userId &&
        req.userRole !== UserRole.SUPER_ADMIN
      ) {
        throw new AppError('Недостаточно прав для удаления', 403);
      }

      // Супер-администратор может полностью удалить клуб
      if (req.userRole === UserRole.SUPER_ADMIN) {
        console.log(`Начало удаления клуба ID: ${clubId}`);
        
        // Используем транзакцию для атомарности операций
        const queryRunner = AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          console.log('Транзакция начата');
          const berthRepository = queryRunner.manager.getRepository(Berth);
          const bookingRepository = queryRunner.manager.getRepository(Booking);
          const incomeRepository = queryRunner.manager.getRepository(Income);
          const expenseRepository = queryRunner.manager.getRepository(Expense);
          const budgetRepository = queryRunner.manager.getRepository(Budget);
          const userClubRepository = queryRunner.manager.getRepository(UserClub);
          const userRepository = queryRunner.manager.getRepository(User);
          const paymentRepository = queryRunner.manager.getRepository(Payment);
          const tariffRepository = queryRunner.manager.getRepository(Tariff);
          const bookingRuleRepository = queryRunner.manager.getRepository(BookingRule);
          const clubRepositoryTransaction = queryRunner.manager.getRepository(Club);
          
          // Загружаем клуб в транзакции
          const clubInTransaction = await clubRepositoryTransaction.findOne({
            where: { id: clubId },
          });
          
          if (!clubInTransaction) {
            throw new AppError('Яхт-клуб не найден в транзакции', 404);
          }

          // Получаем все бронирования клуба для удаления связанных платежей и доходов
          const bookings = await bookingRepository.find({
            where: { clubId: clubId },
            select: ['id'],
          });
          const bookingIds = bookings.map((b) => b.id);

          // Удаляем платежи (payments), связанные с бронированиями клуба
          if (bookingIds.length > 0) {
            await paymentRepository.delete({ bookingId: In(bookingIds) });
          }

          // Удаляем доходы (incomes), связанные с бронированиями клуба
          if (bookingIds.length > 0) {
            await incomeRepository.delete({ bookingId: In(bookingIds) });
          }

          // Сначала удаляем все бронирования, которые ссылаются на места клуба
          // Это важно, так как бронирования имеют внешний ключ на места
          const berths = await berthRepository.find({
            where: { clubId: clubId },
            select: ['id'],
          });
          const berthIds = berths.map((b) => b.id);

          // Удаляем бронирования, связанные с местами клуба
          if (berthIds.length > 0) {
            await bookingRepository.delete({ berthId: In(berthIds) });
          }

          // Удаляем бронирования, напрямую связанные с клубом
          await bookingRepository.delete({ clubId: clubId });

          // Удаляем тарифы (tariffs) перед удалением мест, так как tariff_berths может иметь связи
          await tariffRepository.delete({ clubId: clubId });

          // Удаляем правила бронирования (booking_rules) перед удалением мест
          await bookingRuleRepository.delete({ clubId: clubId });

          // Теперь можно безопасно удалить места (berths)
          // Проверяем, что все бронирования удалены перед удалением мест
          const remainingBookings = await bookingRepository.count({
            where: { clubId: clubId },
          });
          
          if (remainingBookings > 0) {
            throw new AppError('Не удалось удалить все бронирования клуба', 500);
          }

          // Удаляем все места через репозиторий в транзакции
          // Сначала получаем все места
          const allBerths = await berthRepository.find({
            where: { clubId: clubId },
          });
          
          // Удаляем все места
          if (allBerths.length > 0) {
            await berthRepository.remove(allBerths);
            console.log(`Удалено мест через репозиторий: ${allBerths.length}`);
          }
          
          // Дополнительная проверка и удаление через raw SQL, если нужно
          const berthsCheck = await queryRunner.manager.query(
            'SELECT COUNT(*)::int as count FROM berths WHERE "clubId" = $1',
            [clubId]
          );
          
          const remainingCount = berthsCheck[0]?.count || 0;
          if (remainingCount > 0) {
            console.log(`Осталось мест после удаления через репозиторий: ${remainingCount}, удаляем через SQL...`);
            await queryRunner.manager.query(
              'DELETE FROM berths WHERE "clubId" = $1',
              [clubId]
            );
          }

          // Удаляем доходы (incomes), напрямую связанные с клубом
          await incomeRepository.delete({ clubId: clubId });

          // Удаляем расходы (expenses)
          await expenseRepository.delete({ clubId: clubId });

          // Удаляем бюджеты (budgets)
          await budgetRepository.delete({ clubId: clubId });

          // Удаляем связи многие-ко-многим (user_clubs)
          await userClubRepository.delete({ clubId: clubId });

          // Обновляем пользователей, у которых этот клуб был установлен как managedClub
          await userRepository.update(
            { managedClubId: clubId },
            { managedClubId: null }
          );

          // Финальная проверка, что все места удалены
          const finalBerthsCount = await berthRepository.count({
            where: { clubId: clubId },
          });
          
          console.log('Оставшихся мест перед удалением клуба:', finalBerthsCount);
          
          if (finalBerthsCount > 0) {
            throw new AppError(`Не удалось удалить все места клуба. Осталось: ${finalBerthsCount}`, 500);
          }

          // Удаляем клуб через репозиторий в транзакции
          await clubRepositoryTransaction.remove(clubInTransaction);
          console.log('Клуб успешно удален');

          // Коммитим транзакцию
          await queryRunner.commitTransaction();
          res.json({ message: 'Яхт-клуб успешно удален' });
        } catch (error: any) {
          // Откатываем транзакцию в случае ошибки
          try {
            await queryRunner.rollbackTransaction();
          } catch (rollbackError) {
            console.error('Ошибка при откате транзакции:', rollbackError);
          }
          
          // Логируем ошибку для отладки
          console.error('Ошибка при удалении клуба:', error);
          console.error('Сообщение об ошибке:', error?.message);
          console.error('Стек ошибки:', error?.stack);
          
          // Пробрасываем ошибку дальше
          next(error);
        } finally {
          // Освобождаем соединение
          try {
            await queryRunner.release();
          } catch (releaseError) {
            console.error('Ошибка при освобождении соединения:', releaseError);
          }
        }
      } else {
        // Владелец клуба может только деактивировать
        club.isActive = false;
        await clubRepository.save(club);
        res.json({ message: 'Яхт-клуб деактивирован' });
      }
    } catch (error) {
      next(error);
    }
  }
}



