-- Добавление поля isValidated в таблицу users
-- Выполните этот SQL запрос в вашей базе данных PostgreSQL

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS "isValidated" BOOLEAN NOT NULL DEFAULT true;

-- Обновляем существующих пользователей: для CLUB_OWNER устанавливаем false, для остальных true
UPDATE users 
SET "isValidated" = CASE 
  WHEN role = 'club_owner' THEN false 
  ELSE true 
END;

