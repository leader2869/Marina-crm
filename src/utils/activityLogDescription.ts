import { ActivityType, EntityType } from '../entities/ActivityLog';

/**
 * Генерирует понятное описание действия на русском языке
 */
export function generateActivityDescription(
  activityType: ActivityType,
  entityType: EntityType,
  entityId: number | null,
  userName?: string | null,
  entityName?: string | null,
  oldValues?: Record<string, any> | null,
  newValues?: Record<string, any> | null
): string {
  const userText = userName || 'Пользователь';
  
  // Получаем названия сущностей на русском (простые слова)
  const entityNames: Record<EntityType, string> = {
    [EntityType.USER]: 'пользователя',
    [EntityType.CLUB]: 'яхт клуб',
    [EntityType.VESSEL]: 'катер',
    [EntityType.BOOKING]: 'бронь',
    [EntityType.BERTH]: 'место',
    [EntityType.PAYMENT]: 'платеж',
    [EntityType.TARIFF]: 'тариф',
    [EntityType.BOOKING_RULE]: 'правило бронирования',
    [EntityType.OTHER]: 'объект',
  };

  const entityNameText = entityName || entityNames[entityType] || 'объект';
  const entityIdText = entityId ? ` #${entityId}` : '';

  switch (activityType) {
    case ActivityType.CREATE:
      return `${userText} создал ${entityNameText}${entityIdText}`;
    case ActivityType.UPDATE:
      // Для UPDATE формируем описание с изменениями
      if (oldValues && newValues) {
        const changes: string[] = [];
        const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);
        
        // Исключаем служебные поля
        const excludeFields = ['id', 'createdAt', 'updatedAt', 'password', 'photo', 'documentPath'];
        
        for (const key of allKeys) {
          if (excludeFields.includes(key)) continue;
          
          const oldVal = oldValues[key];
          const newVal = newValues[key];
          
          // Пропускаем, если значения одинаковые
          if (oldVal === newVal) continue;
          
          // Форматируем значения для отображения
          const formatValue = (val: any): string => {
            if (val === null || val === undefined) return 'не указано';
            if (typeof val === 'boolean') return val ? 'да' : 'нет';
            if (typeof val === 'object') return JSON.stringify(val);
            return String(val);
          };
          
          const oldFormatted = formatValue(oldVal);
          const newFormatted = formatValue(newVal);
          
          // Получаем название поля на русском
          const fieldNames: Record<string, string> = {
            name: 'Название',
            description: 'Описание',
            address: 'Адрес',
            phone: 'Телефон',
            email: 'Email',
            website: 'Сайт',
            type: 'Тип',
            length: 'Длина',
            width: 'Ширина',
            heightAboveWaterline: 'Высота над ватерлинией',
            registrationNumber: 'Регистрационный номер',
            startDate: 'Дата начала',
            endDate: 'Дата окончания',
            totalPrice: 'Общая стоимость',
            status: 'Статус',
            autoRenewal: 'Автопродление',
            isActive: 'Активен',
            isValidated: 'Валидирован',
            isSubmittedForValidation: 'Отправлен на валидацию',
            rejectionComment: 'Комментарий отклонения',
            totalBerths: 'Количество мест',
            minRentalPeriod: 'Минимальный период аренды',
            maxRentalPeriod: 'Максимальный период аренды',
            basePrice: 'Базовая цена',
            minPricePerMonth: 'Минимальная цена за месяц',
            season: 'Сезон',
            rentalMonths: 'Месяца аренды',
            amount: 'Сумма',
            months: 'Месяца',
            clubId: 'Яхт-клуб',
            tariffId: 'Тариф',
            ruleType: 'Тип правила',
            description: 'Описание',
            parameters: 'Параметры',
          };
          
          const fieldName = fieldNames[key] || key;
          changes.push(`${fieldName}: "${oldFormatted}" → "${newFormatted}"`);
        }
        
        if (changes.length > 0) {
          return `${userText} обновил ${entityNameText}${entityIdText}. Изменения: ${changes.join(', ')}`;
        }
      }
      return `${userText} обновил ${entityNameText}${entityIdText}`;
    case ActivityType.DELETE:
      return `${userText} удалил ${entityNameText}${entityIdText}`;
    case ActivityType.LOGIN:
      return `${userText} вошел в систему`;
    case ActivityType.LOGOUT:
      return `${userText} вышел из системы`;
    case ActivityType.VIEW:
      return `${userText} просмотрел ${entityNameText}${entityIdText}`;
    default:
      return `${userText} выполнил действие с ${entityNameText}${entityIdText}`;
  }
}

