import { AppDataSource } from '../config/database';
import { Payment } from '../entities/Payment';
import { Booking } from '../entities/Booking';
import { Tariff, TariffType } from '../entities/Tariff';
import { BookingRule, BookingRuleType } from '../entities/BookingRule';
import { Club } from '../entities/Club';
import { PaymentType, PaymentMethod, PaymentStatus, Currency } from '../types';
import { subDays } from 'date-fns';
import { IsNull } from 'typeorm';

interface PaymentScheduleItem {
  type: PaymentType;
  amount: number;
  dueDate: Date;
  paymentOrder: number;
  month?: number;
  method?: PaymentMethod;
}

export class PaymentService {
  /**
   * Создает платежи для бронирования на основе тарифа и правил
   */
  static async createPaymentsForBooking(
    booking: Booking,
    club: Club,
    tariff: Tariff | null,
    payerId: number
  ): Promise<Payment[]> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const bookingRuleRepository = AppDataSource.getRepository(BookingRule);
    const payments: Payment[] = [];

    // Получаем правила бронирования
    const rules = await bookingRuleRepository.find({
      where: {
        clubId: club.id,
        tariffId: tariff ? tariff.id : IsNull(),
      },
    });

    // Проверяем, требуется ли залог
    const depositRule = rules.find(
      (rule) => rule.ruleType === BookingRuleType.REQUIRE_DEPOSIT
    );

    let schedule: PaymentScheduleItem[] = [];

    if (tariff) {
      // Создаем график платежей на основе тарифа
      schedule = await this.createScheduleForTariff(
        booking,
        club,
        tariff,
        depositRule
      );
    } else {
      // Стандартный расчет без тарифа
      schedule = await this.createStandardSchedule(
        booking,
        club,
        depositRule
      );
    }

    // Создаем платежи
    for (const item of schedule) {
      const payment = paymentRepository.create({
        bookingId: booking.id,
        payerId,
        amount: item.amount,
        currency: Currency.RUB,
        method: item.method || PaymentMethod.BANK_TRANSFER,
        status: PaymentStatus.PENDING,
        dueDate: item.dueDate,
        paymentType: item.type,
        paymentOrder: item.paymentOrder,
        paymentMonth: item.month || null,
      });

      const savedPayment = await paymentRepository.save(payment);
      payments.push(savedPayment);
    }

    return payments;
  }

  /**
   * Создает график платежей для тарифа
   */
  private static async createScheduleForTariff(
    booking: Booking,
    club: Club,
    tariff: Tariff,
    depositRule: BookingRule | undefined
  ): Promise<PaymentScheduleItem[]> {
    const schedule: PaymentScheduleItem[] = [];
    const totalPrice = parseFloat(String(booking.totalPrice));

    // Проверяем, требуется ли залог
    let depositAmount = 0;
    if (depositRule && depositRule.parameters?.depositAmount) {
      depositAmount = parseFloat(String(depositRule.parameters.depositAmount));
    } else if (depositRule && depositRule.parameters?.depositPercentage) {
      // Если залог указан в процентах
      const percentage = parseFloat(String(depositRule.parameters.depositPercentage));
      depositAmount = (totalPrice * percentage) / 100;
    }

    if (tariff.type === TariffType.SEASON_PAYMENT) {
      // Сезонная оплата
      if (depositAmount > 0) {
        // Залог
        schedule.push({
          type: PaymentType.DEPOSIT,
          amount: depositAmount,
          dueDate: new Date(), // Сразу при бронировании
          paymentOrder: 0,
        });

        // Основной платеж
        schedule.push({
          type: PaymentType.FULL,
          amount: totalPrice - depositAmount,
          dueDate: subDays(booking.startDate, 14), // За 14 дней до начала
          paymentOrder: 1,
        });
      } else {
        // Один платеж на всю сумму
        schedule.push({
          type: PaymentType.FULL,
          amount: totalPrice,
          dueDate: subDays(booking.startDate, 14),
          paymentOrder: 1,
        });
      }
    } else if (tariff.type === TariffType.MONTHLY_PAYMENT) {
      // Помесячная оплата
      const tariffMonths = tariff.months || [];
      const monthlyAmount = parseFloat(String(tariff.amount));

      if (depositAmount > 0) {
        // Залог
        schedule.push({
          type: PaymentType.DEPOSIT,
          amount: depositAmount,
          dueDate: new Date(),
          paymentOrder: 0,
        });
      }

      // Помесячные платежи
      let paymentOrder = 1;
      for (const month of tariffMonths) {
        const seasonYear = club.season || new Date().getFullYear();
        const monthStartDate = new Date(seasonYear, month - 1, 1);

        schedule.push({
          type: PaymentType.MONTHLY,
          amount: monthlyAmount,
          dueDate: subDays(monthStartDate, 7), // За 7 дней до начала месяца
          paymentOrder: paymentOrder++,
          month,
        });
      }
    }

    return schedule;
  }

  /**
   * Создает стандартный график платежей (без тарифа)
   */
  private static async createStandardSchedule(
    booking: Booking,
    club: Club,
    depositRule: BookingRule | undefined
  ): Promise<PaymentScheduleItem[]> {
    const schedule: PaymentScheduleItem[] = [];
    const totalPrice = parseFloat(String(booking.totalPrice));

    // Проверяем, требуется ли залог
    let depositAmount = 0;
    if (depositRule && depositRule.parameters?.depositAmount) {
      depositAmount = parseFloat(String(depositRule.parameters.depositAmount));
    } else if (depositRule && depositRule.parameters?.depositPercentage) {
      const percentage = parseFloat(String(depositRule.parameters.depositPercentage));
      depositAmount = (totalPrice * percentage) / 100;
    }

    if (depositAmount > 0) {
      // Залог
      schedule.push({
        type: PaymentType.DEPOSIT,
        amount: depositAmount,
        dueDate: new Date(),
        paymentOrder: 0,
      });

      // Основной платеж
      schedule.push({
        type: PaymentType.FULL,
        amount: totalPrice - depositAmount,
        dueDate: subDays(booking.startDate, 14),
        paymentOrder: 1,
      });
    } else {
      // Один платеж на всю сумму
      schedule.push({
        type: PaymentType.FULL,
        amount: totalPrice,
        dueDate: subDays(booking.startDate, 14),
        paymentOrder: 1,
      });
    }

    return schedule;
  }

  /**
   * Проверяет, все ли обязательные платежи оплачены для подтверждения бронирования
   */
  static async areRequiredPaymentsPaid(bookingId: number): Promise<boolean> {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const payments = await paymentRepository.find({
      where: { bookingId },
    });

    // Для подтверждения нужно оплатить:
    // 1. Залог (если есть) - paymentOrder = 0
    // 2. Первый основной платеж - paymentOrder = 1

    const deposit = payments.find((p) => p.paymentOrder === 0);
    const firstPayment = payments.find((p) => p.paymentOrder === 1);

    // Если есть залог, он должен быть оплачен
    if (deposit && deposit.status !== PaymentStatus.PAID) {
      return false;
    }

    // Первый основной платеж должен быть оплачен
    if (firstPayment && firstPayment.status !== PaymentStatus.PAID) {
      return false;
    }

    // Если нет ни залога, ни первого платежа, проверяем любой платеж
    if (!deposit && !firstPayment) {
      const anyPaid = payments.some((p) => p.status === PaymentStatus.PAID);
      return anyPaid;
    }

    return true;
  }

  /**
   * Получает график платежей для бронирования
   */
  static async getPaymentSchedule(bookingId: number) {
    const paymentRepository = AppDataSource.getRepository(Payment);
    const payments = await paymentRepository.find({
      where: { bookingId },
      order: { paymentOrder: 'ASC', dueDate: 'ASC' },
    });

    const totalAmount = payments.reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
    const paidAmount = payments
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + parseFloat(String(p.amount)), 0);
    const remainingAmount = totalAmount - paidAmount;

    const nextPayment = payments.find(
      (p) => p.status === PaymentStatus.PENDING && p.dueDate >= new Date()
    );

    return {
      payments: payments.map((p) => ({
        paymentId: p.id,
        type: p.paymentType,
        amount: parseFloat(String(p.amount)),
        dueDate: p.dueDate,
        status: p.status,
        paymentOrder: p.paymentOrder,
        month: p.paymentMonth,
        paidDate: p.paidDate,
      })),
      totalAmount,
      paidAmount,
      remainingAmount,
      nextPaymentDue: nextPayment?.dueDate || null,
    };
  }
}

