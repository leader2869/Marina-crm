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

