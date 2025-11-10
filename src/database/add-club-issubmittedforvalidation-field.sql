-- Добавляем поле isSubmittedForValidation в таблицу clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS "isSubmittedForValidation" BOOLEAN NOT NULL DEFAULT false;

-- Устанавливаем isSubmittedForValidation = true для существующих клубов с isValidated = true
-- (они уже были валидированы, значит были отправлены на валидацию)
UPDATE clubs
SET "isSubmittedForValidation" = true
WHERE "isValidated" = true;

