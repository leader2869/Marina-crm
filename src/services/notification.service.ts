import nodemailer from 'nodemailer';
import { config } from '../config/env';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserRole } from '../types';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class NotificationService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Инициализируем транспортер только если настроены SMTP параметры
    if (config.email.user && config.email.password) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // true для 465, false для других портов
        auth: {
          user: config.email.user,
          pass: config.email.password,
        },
      });
    } else {
      console.warn('⚠️  SMTP не настроен. Уведомления не будут отправляться.');
    }
  }

  /**
   * Отправка email уведомления
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      console.log('📧 [Email не отправлен - SMTP не настроен]', {
        to: options.to,
        subject: options.subject,
      });
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      });

      console.log('✅ Email отправлен:', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      });
    } catch (error) {
      console.error('❌ Ошибка отправки email:', error);
      throw error;
    }
  }

  /**
   * Получить список пользователей для уведомлений о новых заказах
   * По умолчанию отправляем всем активным пользователям
   */
  async getUsersForOrderNotifications(roles?: UserRole[]): Promise<User[]> {
    const userRepository = AppDataSource.getRepository(User);
    
    const queryBuilder = userRepository.createQueryBuilder('user')
      .where('user.isActive = :isActive', { isActive: true })
      .select(['user.id', 'user.email', 'user.firstName', 'user.lastName', 'user.role']);
    
    // Если указаны конкретные роли, фильтруем по ним
    if (roles && roles.length > 0) {
      queryBuilder.andWhere('user.role IN (:...roles)', { roles });
    }
    
    const users = await queryBuilder.getMany();

    return users;
  }

  /**
   * Отправить уведомление о новом агентском заказе
   */
  async notifyNewAgentOrder(order: {
    id: number;
    title: string;
    description: string;
    startDate: Date;
    endDate: Date;
    passengerCount: number;
    budget?: number;
    route?: string;
    createdBy?: { firstName: string; lastName: string };
  }): Promise<void> {
    try {
      // Получаем список пользователей для уведомлений
      const users = await this.getUsersForOrderNotifications();

      if (users.length === 0) {
        console.log('ℹ️  Нет пользователей для отправки уведомлений о новом заказе');
        return;
      }

      // Формируем содержимое письма
      const orderDateRange = `${new Date(order.startDate).toLocaleDateString('ru-RU')} - ${new Date(order.endDate).toLocaleDateString('ru-RU')}`;
      const budgetText = order.budget ? `<p><strong>Бюджет:</strong> ${order.budget.toLocaleString('ru-RU')} ₽</p>` : '';
      const routeText = order.route ? `<p><strong>Маршрут:</strong> ${order.route}</p>` : '';
      const creatorText = order.createdBy 
        ? `<p><strong>Создатель заказа:</strong> ${order.createdBy.firstName} ${order.createdBy.lastName}</p>` 
        : '';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
            .order-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #2563eb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
            .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Новый агентский заказ</h1>
            </div>
            <div class="content">
              <p>Здравствуйте!</p>
              <p>Создан новый агентский заказ, на который вы можете откликнуться.</p>
              
              <div class="order-info">
                <h2>${order.title}</h2>
                <p><strong>Описание:</strong> ${order.description}</p>
                <p><strong>Даты:</strong> ${orderDateRange}</p>
                <p><strong>Количество пассажиров:</strong> ${order.passengerCount}</p>
                ${budgetText}
                ${routeText}
                ${creatorText}
              </div>

              <p>Перейдите в раздел "Агентские заказы" → "Активные заказы" для просмотра деталей и отклика на заказ.</p>
              
              <a href="${config.frontendUrl}/agent-orders" class="button">Посмотреть заказ</a>
            </div>
            <div class="footer">
              <p>Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const subject = `Новый агентский заказ: ${order.title}`;

      // Отправляем уведомления всем пользователям
      const emailPromises = users.map(user => 
        this.sendEmail({
          to: user.email,
          subject: subject,
          html: html,
        }).catch(error => {
          console.error(`❌ Ошибка отправки уведомления пользователю ${user.email}:`, error);
          // Не прерываем выполнение, если одно письмо не отправилось
        })
      );

      await Promise.allSettled(emailPromises);
      
      console.log(`✅ Уведомления о новом заказе #${order.id} отправлены ${users.length} пользователям`);
    } catch (error) {
      console.error('❌ Ошибка при отправке уведомлений о новом заказе:', error);
      // Не пробрасываем ошибку, чтобы не прерывать создание заказа
    }
  }
}

export const notificationService = new NotificationService();

