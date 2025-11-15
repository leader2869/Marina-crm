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

    console.log('[PaymentService] Найдено правил:', rules.length);
    rules.forEach(rule => {
      console.log('[PaymentService] Правило:', {
        id: rule.id,
        ruleType: rule.ruleType,
        tariffId: rule.tariffId,
        parameters: rule.parameters
      });
    });

    // Проверяем, требуется ли залог
    const depositRule = rules.find(
      (rule) => rule.ruleType === BookingRuleType.REQUIRE_DEPOSIT
    );
    console.log('[PaymentService] Правило залога (depositRule):', depositRule ? {
      id: depositRule.id,
      ruleType: depositRule.ruleType,
      parameters: depositRule.parameters
    } : 'не найдено');

    let schedule: PaymentScheduleItem[] = [];

    if (tariff) {
      // Создаем график платежей на основе тарифа
      console.log('[PaymentService] Создание платежей для тарифа:', {
        id: tariff.id,
        name: tariff.name,
        type: tariff.type,
        isSeasonPayment: tariff.type === TariffType.SEASON_PAYMENT,
        isMonthlyPayment: tariff.type === TariffType.MONTHLY_PAYMENT
      });
      schedule = await this.createScheduleForTariff(
        booking,
        club,
        tariff,
        depositRule
      );
      console.log('[PaymentService] Создан график платежей:', schedule.length, 'платежей');
    } else {
      // Стандартный расчет без тарифа
      console.log('[PaymentService] Создание платежей БЕЗ тарифа (стандартный график)');
      schedule = await this.createStandardSchedule(
        booking,
        club,
        depositRule
      );
      console.log('[PaymentService] Создан стандартный график платежей:', schedule.length, 'платежей');
    }

    // Создаем платежи
    for (const item of schedule) {
      console.log('[PaymentService] Создаем платеж:', {
        type: item.type,
        amount: item.amount,
        dueDate: item.dueDate,
        paymentOrder: item.paymentOrder,
      });
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
      console.log('[PaymentService] Платеж сохранен в БД:', {
        id: savedPayment.id,
        dueDate: savedPayment.dueDate,
        type: savedPayment.paymentType,
      });
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

    console.log('[PaymentService] Проверка типа тарифа:', {
      tariffType: tariff.type,
      tariffTypeString: String(tariff.type),
      SEASON_PAYMENT: TariffType.SEASON_PAYMENT,
      SEASON_PAYMENTString: String(TariffType.SEASON_PAYMENT),
      isEqual: tariff.type === TariffType.SEASON_PAYMENT,
      isEqualString: String(tariff.type) === String(TariffType.SEASON_PAYMENT),
    });

    if (tariff.type === TariffType.SEASON_PAYMENT || String(tariff.type) === String(TariffType.SEASON_PAYMENT)) {
      // Сезонная оплата - один платеж сразу (в течение 15 минут)
      console.log('[PaymentService] ✅ SEASON_PAYMENT тариф обнаружен! depositAmount:', depositAmount, 'totalPrice:', totalPrice);
      if (depositAmount > 0) {
        // Если есть залог - только залог (основной платеж не создаем)
        const dueDate = new Date();
        console.log('[PaymentService] ✅ Создаем залог с dueDate:', dueDate.toISOString());
        schedule.push({
          type: PaymentType.DEPOSIT,
          amount: depositAmount,
          dueDate: dueDate, // Сразу при бронировании (15 минут на оплату)
          paymentOrder: 0,
        });
      } else {
        // Один платеж на всю сумму
        const dueDate = new Date();
        console.log('[PaymentService] ✅ Создаем один платеж на всю сумму с dueDate:', dueDate.toISOString());
        schedule.push({
          type: PaymentType.FULL,
          amount: totalPrice,
          dueDate: dueDate, // Сразу при бронировании (15 минут на оплату)
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

