-- Добавляем поле isValidated в таблицу clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS "isValidated" BOOLEAN NOT NULL DEFAULT false;

-- Устанавливаем isValidated = true для существующих клубов (они уже были созданы до введения валидации)
UPDATE clubs
SET "isValidated" = true
WHERE "isValidated" = false;

