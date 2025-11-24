import { Response, NextFunction } from 'express';
import { AppDataSource } from '../../config/database';
import { AgentOrder, AgentOrderStatus } from '../../entities/AgentOrder';
import { AgentOrderResponse, AgentOrderResponseStatus } from '../../entities/AgentOrderResponse';
import { Vessel } from '../../entities/Vessel';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination';

export class AgentOrdersController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = getPaginationParams(
        parseInt(req.query.page as string),
        parseInt(req.query.limit as string)
      );

      const { status } = req.query;
      const orderRepository = AppDataSource.getRepository(AgentOrder);

      const queryBuilder = orderRepository
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.createdBy', 'createdBy')
        .leftJoinAndSelect('order.selectedVessel', 'selectedVessel')
        .leftJoinAndSelect('order.responses', 'responses')
        .leftJoinAndSelect('responses.vessel', 'responseVessel')
        .leftJoinAndSelect('responses.vesselOwner', 'responseVesselOwner');

      // Фильтр по статусу
      if (status && Object.values(AgentOrderStatus).includes(status as AgentOrderStatus)) {
        queryBuilder.where('order.status = :status', { status });
      }

      // Сортировка: сначала активные, потом по дате создания
      queryBuilder.orderBy('order.status', 'ASC')
        .addOrderBy('order.createdAt', 'DESC');

      const [orders, total] = await queryBuilder
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      res.json(createPaginatedResponse(orders, total, page, limit));
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
        relations: ['createdBy', 'selectedVessel', 'responses', 'responses.vessel', 'responses.vesselOwner'],
      });

      if (!order) {
        throw new AppError('Заказ не найден', 404);
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
        endDate,
        passengerCount,
        budget,
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
        endDate: new Date(endDate),
        passengerCount: parseInt(passengerCount),
        budget: budget ? parseFloat(budget) : null,
        route: route || null,
        additionalRequirements: additionalRequirements || null,
        status: AgentOrderStatus.ACTIVE,
        createdById: req.userId,
      });

      const savedOrder = await orderRepository.save(order);

      const orderWithRelations = await orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['createdBy', 'selectedVessel', 'responses'],
      });

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

      // Обновляем заказ: выбираем катер и меняем статус
      order.selectedVesselId = response.vesselId;
      order.status = AgentOrderStatus.IN_PROGRESS;
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
        relations: ['createdBy', 'selectedVessel', 'responses', 'responses.vessel', 'responses.vesselOwner'],
      });

      res.json(updatedOrder);
    } catch (error) {
      next(error);
    }
  }
}

