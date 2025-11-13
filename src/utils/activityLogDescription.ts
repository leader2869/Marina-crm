import { ActivityType, EntityType } from '../entities/ActivityLog';

/**
 * Генерирует понятное описание действия на русском языке
 */
export function generateActivityDescription(
  activityType: ActivityType,
  entityType: EntityType,
  entityId: number | null,
  userName?: string | null,
  entityName?: string | null
): string {
  const userText = userName || 'Пользователь';
  
  // Получаем названия сущностей на русском
  const entityNames: Record<EntityType, string> = {
    [EntityType.USER]: 'пользователя',
    [EntityType.CLUB]: 'яхт-клуб',
    [EntityType.VESSEL]: 'судно',
    [EntityType.BOOKING]: 'бронирование',
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
      return `${userText} создал(а) ${entityNameText}${entityIdText}`;
    case ActivityType.UPDATE:
      return `${userText} обновил(а) ${entityNameText}${entityIdText}`;
    case ActivityType.DELETE:
      return `${userText} удалил(а) ${entityNameText}${entityIdText}`;
    case ActivityType.LOGIN:
      return `${userText} вошел(а) в систему`;
    case ActivityType.LOGOUT:
      return `${userText} вышел(а) из системы`;
    case ActivityType.VIEW:
      return `${userText} просмотрел(а) ${entityNameText}${entityIdText}`;
    default:
      return `${userText} выполнил(а) действие с ${entityNameText}${entityIdText}`;
  }
}

