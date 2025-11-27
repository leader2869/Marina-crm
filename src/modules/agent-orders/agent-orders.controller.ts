import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { AgentOrder, AgentOrderStatus } from '../../entities/AgentOrder';
import { AgentOrderResponse, AgentOrderResponseStatus } from '../../entities/AgentOrderResponse';
import { Vessel } from '../../entities/Vessel';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';
import { notificationService } from '../../services/notification.service';
import { In } from 'typeorm';

export class AgentOrdersController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const { status } = req.query;
      
      // Проверяем аутентификацию для завершенных заказов
      if ((status === AgentOrderStatus.COMPLETED || status === 'completed') && !req.userId) {
        throw new AppError('Требуется аутентификация для просмотра завершенных заказов', 401);
      }
      const orderRepository = AppDataSource.getRepository(AgentOrder);

      const queryBuilder = orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.createdBy', 'createdBy')
        .leftJoin('order.selectedVessel', 'selectedVesselJoin')
        .leftJoin('selectedVesselJoin.owner', 'vesselOwnerJoin');

      // Для завершенных заказов загружаем выбранный катер с фотографиями
      // Для активных заказов выбранный катер не нужен
      if (status === AgentOrderStatus.COMPLETED || status === 'completed') {
        queryBuilder
          .leftJoinAndSelect('order.selectedVessel', 'selectedVessel')
          .leftJoin('selectedVessel.owner', 'vesselOwner')
          .addSelect([
            'vesselOwner.id',
            'vesselOwner.firstName',
            'vesselOwner.lastName',
            'vesselOwner.email',
            'vesselOwner.phone'
          ]);
      }

      // Для активных заказов загружаем только количество откликов, без самих откликов
      // Это значительно уменьшает объем данных
      if (status === AgentOrderStatus.ACTIVE || status === 'active') {
        queryBuilder
          .loadRelationCountAndMap('order.responsesCount', 'order.responses');
      } else {
        // Для завершенных заказов отклики не нужны вообще
        // Для других статусов тоже не загружаем отклики в списке
      }

      // Фильтр по статусу
      if (status && Object.values(AgentOrderStatus).includes(status as AgentOrderStatus)) {
        // Для завершенных заказов показываем только те, где пользователь создатель или владелец выбранного катера
        if (status === AgentOrderStatus.COMPLETED || status === 'completed') {
          if (!req.userId) {
            throw new AppError('Требуется аутентификация', 401);
          }
          queryBuilder.where('order.status = :status', { status: AgentOrderStatus.COMPLETED })
            .andWhere('(order.createdById = :userId OR selectedVesselJoin.ownerId = :userId)', { userId: req.userId });
        } else {
          queryBuilder.where('order.status = :status', { status });
        }
      }

      // Сортировка: для завершенных заказов только по дате создания (DESC)
      // Для других статусов сначала активные, потом по дате создания
      if (status === AgentOrderStatus.COMPLETED || status === 'completed') {
        queryBuilder.orderBy('order.createdAt', 'DESC');
      } else {
        queryBuilder.orderBy('order.status', 'ASC')
          .addOrderBy('order.createdAt', 'DESC');
      }

      // Для завершенных заказов используем более эффективный способ подсчета
      // Сначала получаем заказы, затем считаем total отдельным запросом
      const orders = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

      // Подсчитываем total отдельным запросом для оптимизации
      let total = 0;
      if (status === AgentOrderStatus.COMPLETED || status === 'completed') {
        // Для завершенных заказов используем упрощенный запрос для подсчета
        const countQueryBuilder = orderRepository
          .createQueryBuilder('order')
          .leftJoin('order.selectedVessel', 'selectedVesselJoin')
          .where('order.status = :status', { status: AgentOrderStatus.COMPLETED })
          .andWhere('(order.createdById = :userId OR selectedVesselJoin.ownerId = :userId)', { userId: req.userId });
        total = await countQueryBuilder.getCount();
      } else {
        // Для других статусов используем обычный подсчет
        const countQueryBuilder = orderRepository
          .createQueryBuilder('order')
          .where('order.status = :status', { status });
        total = await countQueryBuilder.getCount();
      }

      // Для завершенных заказов загружаем принятый отклик отдельно для получения цены
      if ((status === AgentOrderStatus.COMPLETED || status === 'completed') && orders.length > 0) {
        try {
          const responseRepository = AppDataSource.getRepository(AgentOrderResponse);
          const orderIds = orders.map(o => o.id);
          
          // Проверяем, что есть ID заказов
          if (orderIds.length > 0) {
            // Загружаем все принятые отклики одним запросом (без relations для ускорения)
            const acceptedResponses = await responseRepository.find({
              where: {
                orderId: In(orderIds),
                status: AgentOrderResponseStatus.ACCEPTED,
              },
              // Не загружаем relations, так как нужна только цена
              select: ['id', 'orderId', 'proposedPrice', 'status'],
            });
            // Создаем мапу для быстрого поиска
            const responsesMap = new Map(acceptedResponses.map(r => [r.orderId, r]));
            // Присваиваем принятый отклик каждому заказу
            for (const order of orders) {
              (order as any).acceptedResponse = responsesMap.get(order.id) || null;
            }
          }
        } catch (error) {
          console.error('Ошибка загрузки принятых откликов для завершенных заказов:', error);
          // Продолжаем выполнение даже если не удалось загрузить отклики
          for (const order of orders) {
            (order as any).acceptedResponse = null;
          }
        }
      }

      // Парсим JSON строки в массивы для фотографий только для выбранного катера в завершенных заказах
      // Ограничиваем количество фотографий для оптимизации (берем только первые 3 для списка)
      // Но сохраняем первую фотографию как главную, даже если mainPhotoIndex указывает на другую
      const ordersWithParsedPhotos = orders.map((order: any) => {
        // Парсим фотографии только для выбранного катера в завершенных заказах
        if (order.selectedVessel && order.selectedVessel.photos) {
          try {
            const allPhotos = JSON.parse(order.selectedVessel.photos);
            if (Array.isArray(allPhotos) && allPhotos.length > 0) {
              // Ограничиваем количество фотографий для списка (первые 3)
              order.selectedVessel.photos = allPhotos.slice(0, 3);
              // Убеждаемся, что mainPhotoIndex указывает на существующую фотографию
              // Если mainPhotoIndex больше или равен длине ограниченного массива, используем 0
              if (order.selectedVessel.mainPhotoIndex !== undefined && order.selectedVessel.mainPhotoIndex !== null) {
                if (order.selectedVessel.mainPhotoIndex >= order.selectedVessel.photos.length) {
                  order.selectedVessel.mainPhotoIndex = 0;
                }
              } else {
                order.selectedVessel.mainPhotoIndex = 0;
              }
            } else {
              order.selectedVessel.photos = [];
              order.selectedVessel.mainPhotoIndex = null;
            }
          } catch (e) {
            order.selectedVessel.photos = [];
            order.selectedVessel.mainPhotoIndex = null;
          }
        } else if (order.selectedVessel) {
          order.selectedVessel.photos = [];
          order.selectedVessel.mainPhotoIndex = null;
        }
        
        return order;
      });

      res.json(createPaginatedResponse(ordersWithParsedPhotos, total, page, limit));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const orderRepository = AppDataSource.getRepository(AgentOrder);

      const order = await orderRepository.findOne({
        where: { id: parseInt(id) },
        relations: ['createdBy', 'selectedVessel', 'selectedVessel.owner', 'responses', 'responses.vessel', 'responses.vesselOwner'],
      });

      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }

      // Парсим JSON строки в массивы для фотографий катеров в откликах
      if ((order as any).responses && Array.isArray((order as any).responses)) {
        (order as any).responses = (order as any).responses.map((response: any) => {
          if (response.vessel && response.vessel.photos) {
            try {
              response.vessel.photos = JSON.parse(response.vessel.photos);
            } catch (e) {
              response.vessel.photos = [];
            }
          } else if (response.vessel) {
            response.vessel.photos = [];
          }
          return response;
        });
      }

      res.json(order);
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
        title,
        description,
        startDate,
        startTime,
        hoursCount,
        endDate,
        passengerCount,
        budget,
        budgetFrom,
        budgetTo,
        route,
        additionalRequirements,
      } = req.body;

      if (!title || !description || !startDate || !endDate || !passengerCount) {
        throw new AppError('Заполните все обязательные поля', 400);
      }

      const orderRepository = AppDataSource.getRepository(AgentOrder);

      const order = orderRepository.create({
        title,
        description,
        startDate: new Date(startDate),
        startTime: startTime || null,
        hoursCount: hoursCount ? parseFloat(hoursCount) : null,
        endDate: new Date(endDate),
        passengerCount: parseInt(passengerCount),
        budget: budget ? parseFloat(budget) : null, // Для обратной совместимости
        budgetFrom: budgetFrom ? parseFloat(budgetFrom) : null,
        budgetTo: budgetTo ? parseFloat(budgetTo) : null,
        route: route || null,
        additionalRequirements: additionalRequirements || null,
        status: AgentOrderStatus.ACTIVE,
        createdById: req.userId,
      });

      const savedOrder = await orderRepository.save(order);

      const orderWithRelations = await orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['createdBy', 'selectedVessel', 'selectedVessel.owner', 'responses'],
      });

      // Отправляем уведомления всем пользователям о новом заказе
      if (orderWithRelations) {
        notificationService.notifyNewAgentOrder({
          id: orderWithRelations.id,
          title: orderWithRelations.title,
          description: orderWithRelations.description,
          startDate: orderWithRelations.startDate,
          endDate: orderWithRelations.endDate,
          passengerCount: orderWithRelations.passengerCount,
          budget: orderWithRelations.budget ? parseFloat(orderWithRelations.budget.toString()) : undefined,
          route: orderWithRelations.route || undefined,
          createdBy: orderWithRelations.createdBy ? {
            firstName: orderWithRelations.createdBy.firstName,
            lastName: orderWithRelations.createdBy.lastName,
          } : undefined,
        }).catch(error => {
          console.error('Ошибка отправки уведомлений о новом заказе:', error);
          // Не прерываем выполнение, если уведомления не отправились
        });
      }

      res.status(201).json(orderWithRelations);
    } catch (error) {
      next(error);
    }
  }

  async respond(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { orderId } = req.params;
      const { vesselId, message, proposedPrice } = req.body;

      if (!vesselId) {
        throw new AppError('Необходимо указать катер', 400);
      }

      const orderRepository = AppDataSource.getRepository(AgentOrder);
      const responseRepository = AppDataSource.getRepository(AgentOrderResponse);
      const vesselRepository = AppDataSource.getRepository(Vessel);

      // Проверяем существование заказа
      const order = await orderRepository.findOne({ where: { id: parseInt(orderId) } });
      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }

      if (order.status !== AgentOrderStatus.ACTIVE) {
        throw new AppError('На этот заказ нельзя откликнуться', 400);
      }

      // Проверяем, что катер принадлежит пользователю
      const vessel = await vesselRepository.findOne({ where: { id: vesselId } });
      if (!vessel) {
        throw new AppError('Катер не найден', 404);
      }

      if (vessel.ownerId !== req.userId && req.userRole !== 'super_admin') {
        throw new AppError('Катер не принадлежит вам', 403);
      }

      // Проверяем, не откликался ли уже пользователь с этим катером
      const existingResponse = await responseRepository.findOne({
        where: { orderId: parseInt(orderId), vesselId },
      });

      if (existingResponse) {
        throw new AppError('Вы уже откликнулись на этот заказ с этим катером', 400);
      }

      // Создаем отклик
      const response = responseRepository.create({
        orderId: parseInt(orderId),
        vesselOwnerId: req.userId,
        vesselId,
        message: message || null,
        proposedPrice: proposedPrice ? parseFloat(proposedPrice) : null,
        status: AgentOrderResponseStatus.PENDING,
      });

      const savedResponse = await responseRepository.save(response);

      const responseWithRelations = await responseRepository.findOne({
        where: { id: savedResponse.id },
        relations: ['order', 'vessel', 'vesselOwner'],
      });

      res.status(201).json(responseWithRelations);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const orderId = parseInt(id);

      if (isNaN(orderId)) {
        throw new AppError('Неверный ID заказа', 400);
      }

      const orderRepository = AppDataSource.getRepository(AgentOrder);
      const order = await orderRepository.findOne({
        where: { id: orderId },
        relations: ['createdBy'],
      });

      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }

      // Проверяем права: только создатель заказа или суперадмин может отменить
      if (order.createdById !== req.userId && req.userRole !== 'super_admin') {
        throw new AppError('У вас нет прав для отмены этого заказа', 403);
      }

      // Проверяем, что заказ можно отменить (только активные или в процессе)
      if (order.status === AgentOrderStatus.COMPLETED) {
        throw new AppError('Нельзя отменить завершенный заказ', 400);
      }

      if (order.status === AgentOrderStatus.CANCELLED) {
        throw new AppError('Заказ уже отменен', 400);
      }

      // Обновляем статус на отменен
      order.status = AgentOrderStatus.CANCELLED;
      await orderRepository.save(order);

      // Загружаем заказ с отношениями для ответа
      const orderWithRelations = await orderRepository.findOne({
        where: { id: orderId },
        relations: ['createdBy', 'selectedVessel', 'selectedVessel.owner', 'responses', 'responses.vessel', 'responses.vesselOwner'],
      });

      res.json({
        message: 'Заказ успешно отменен',
        order: orderWithRelations,
      });
    } catch (error) {
      next(error);
    }
  }

  async selectVessel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        throw new AppError('Требуется аутентификация', 401);
      }

      const { orderId } = req.params;
      const { responseId } = req.body;

      if (!responseId) {
        throw new AppError('Необходимо указать отклик', 400);
      }

      const orderRepository = AppDataSource.getRepository(AgentOrder);
      const responseRepository = AppDataSource.getRepository(AgentOrderResponse);

      // Проверяем существование заказа
      const order = await orderRepository.findOne({ where: { id: parseInt(orderId) } });
      if (!order) {
        throw new AppError('Заказ не найден', 404);
      }

      // Проверяем, что пользователь является создателем заказа
      if (order.createdById !== req.userId && req.userRole !== 'super_admin') {
        throw new AppError('Недостаточно прав для выбора катера', 403);
      }

      // Проверяем существование отклика
      const response = await responseRepository.findOne({
        where: { id: responseId, orderId: parseInt(orderId) },
        relations: ['vessel'],
      });

      if (!response) {
        throw new AppError('Отклик не найден', 404);
      }

      // Обновляем заказ: выбираем катер и меняем статус на завершенный
      order.selectedVesselId = response.vesselId;
      order.status = AgentOrderStatus.COMPLETED;
      await orderRepository.save(order);

      // Обновляем статус выбранного отклика
      response.status = AgentOrderResponseStatus.ACCEPTED;
      await responseRepository.save(response);

      // Отклоняем остальные отклики
      await responseRepository
        .createQueryBuilder()
        .update(AgentOrderResponse)
        .set({ status: AgentOrderResponseStatus.REJECTED })
        .where('orderId = :orderId AND id != :responseId', { orderId: parseInt(orderId), responseId })
        .execute();

      const updatedOrder = await orderRepository.findOne({
        where: { id: parseInt(orderId) },
        relations: ['createdBy', 'selectedVessel', 'selectedVessel.owner', 'responses', 'responses.vessel', 'responses.vesselOwner'],
      });

      // Парсим JSON строки в массивы для фотографий катеров в откликах
      if (updatedOrder && (updatedOrder as any).responses && Array.isArray((updatedOrder as any).responses)) {
        (updatedOrder as any).responses = (updatedOrder as any).responses.map((response: any) => {
          if (response.vessel && response.vessel.photos) {
            try {
              response.vessel.photos = JSON.parse(response.vessel.photos);
            } catch (e) {
              response.vessel.photos = [];
            }
          } else if (response.vessel) {
            response.vessel.photos = [];
          }
          return response;
        });
      }

      res.json(updatedOrder);
    } catch (error) {
      next(error);
    }
  }
}

