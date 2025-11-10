-- Добавляем поле rejectionComment в таблицу clubs
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS "rejectionComment" TEXT;

-- Обновляем существующие записи, устанавливая rejectionComment в NULL
UPDATE clubs
SET "rejectionComment" = NULL
WHERE "rejectionComment" IS NULL;

