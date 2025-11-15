import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment';
import { Booking } from '../entities/Booking';
import { Berth } from '../entities/Berth';
import { PaymentStatus, BookingStatus } from '../types';
import { addMinutes } from 'date-fns';
import { ActivityLogService } from './activityLog.service';
import { ActivityType, EntityType } from '../entities/ActivityLog';

/**
 * Сервис для проверки просроченных платежей с немедленной оплатой
 * Платежи, которые должны быть оплачены сразу при бронировании (в течение 2 минут)
 */
export class ImmediatePaymentCheckService {
  /**
   * Проверяет просроченные платежи с немедленной оплатой и отменяет бронирования
   */
  static async checkOverdueImmediatePayments(): Promise<void> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const bookingRepository = AppDataSource.getRepository(Booking);

    try {
      const twoMinutesAgo = addMinutes(new Date(), -2);

      // Находим платежи, которые:
      // 1. Имеют статус PENDING
      // 2. Созданы более 2 минут назад
      // 3. dueDate близко к createdAt (в пределах 5 минут) - это платежи с немедленной оплатой
      const overdueImmediatePayments = await paymentRepository
        .createQueryBuilder('payment')
        .leftJoinAndSelect('payment.booking', 'booking')
        .leftJoinAndSelect('booking.berth', 'berth')
        .where('payment.status = :status', { status: PaymentStatus.PENDING })
        .andWhere('payment.createdAt <= :twoMinutesAgo', { twoMinutesAgo })
        .andWhere(
          `ABS(EXTRACT(EPOCH FROM (payment."dueDate" - payment."createdAt"))) <= 300`
        ) // dueDate в пределах 5 минут от createdAt
        .getMany();

      console.log(
        `[ImmediatePaymentCheck] Найдено просроченных платежей с немедленной оплатой: ${overdueImmediatePayments.length}`
      );

      for (const payment of overdueImmediatePayments) {
        try {
          // Проверяем, что платеж все еще не оплачен (на случай, если оплата произошла между проверками)
          const currentPayment = await paymentRepository.findOne({
            where: { id: payment.id },
          });

          if (!currentPayment || currentPayment.status !== PaymentStatus.PENDING) {
            console.log(
              `[ImmediatePaymentCheck] Платеж ${payment.id} уже оплачен или изменен, пропускаем`
            );
            continue;
          }

          // Обновляем статус платежа на OVERDUE
          currentPayment.status = PaymentStatus.OVERDUE;
          await paymentRepository.save(currentPayment);

          console.log(
            `[ImmediatePaymentCheck] Платеж ${payment.id} помечен как просроченный (OVERDUE)`
          );

          // Получаем бронирование
          const booking = await bookingRepository.findOne({
            where: { id: payment.bookingId },
            relations: ['berth', 'club', 'vessel'],
          });

          if (!booking) {
            console.error(
              `[ImmediatePaymentCheck] Бронирование ${payment.bookingId} не найдено для платежа ${payment.id}`
            );
            continue;
          }

          // Проверяем, что бронирование еще в статусе PENDING
          if (booking.status !== BookingStatus.PENDING) {
            console.log(
              `[ImmediatePaymentCheck] Бронирование ${booking.id} уже не в статусе PENDING (текущий статус: ${booking.status}), пропускаем отмену`
            );
            continue;
          }

          // Отменяем бронирование
          booking.status = BookingStatus.CANCELLED;
          await bookingRepository.save(booking);

          console.log(
            `[ImmediatePaymentCheck] ✅ Бронирование ${booking.id} отменено из-за просрочки платежа ${payment.id}`
          );

          // Логируем автоматическую отмену бронирования
          const clubName = booking.club?.name || 'неизвестный клуб';
          const vesselName = booking.vessel?.name || 'неизвестное судно';
          const berthNumber = booking.berth?.number || 'неизвестное место';
          const description = `Система автоматически отменила бронь #${booking.id}: судно "${vesselName}" на месте ${berthNumber} в яхт-клубе "${clubName}" из-за непогашения платежа в течение 2 минут (платеж #${payment.id})`;

          await ActivityLogService.logActivity({
            activityType: ActivityType.DELETE,
            entityType: EntityType.BOOKING,
            entityId: booking.id,
            userId: null, // Системное действие
            description,
            oldValues: { status: BookingStatus.PENDING },
            newValues: { status: BookingStatus.CANCELLED },
            ipAddress: null,
            userAgent: 'System: ImmediatePaymentCheckService',
          });

          // Освобождаем место (berth)
          if (booking.berth) {
            const berthRepository = AppDataSource.getRepository(Berth);
            await berthRepository.update(
              { id: booking.berthId },
              { isAvailable: true }
            );
            console.log(
              `[ImmediatePaymentCheck] Место ${booking.berthId} освобождено`
            );
          }
        } catch (error: any) {
          console.error(
            `[ImmediatePaymentCheck] Ошибка при обработке платежа ${payment.id}:`,
            error.message
          );
          // Продолжаем обработку других платежей
        }
      }
    } catch (error: any) {
      console.error(
        '[ImmediatePaymentCheck] Ошибка при проверке просроченных платежей:',
        error.message
      );
    }
  }

  /**
   * Запускает периодическую проверку просроченных платежей
   * @param intervalMinutes Интервал проверки в минутах (по умолчанию 30 секунд)
   */
  static startPeriodicCheck(intervalSeconds: number = 30): NodeJS.Timeout {
    console.log(
      `[ImmediatePaymentCheck] Запуск периодической проверки каждые ${intervalSeconds} секунд`
    );

    // Выполняем проверку сразу при запуске
    this.checkOverdueImmediatePayments();

    // Затем запускаем периодическую проверку
    return setInterval(() => {
      this.checkOverdueImmediatePayments();
    }, intervalSeconds * 1000);
  }
}

