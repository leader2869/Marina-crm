-- Создание таблицы тарифов
CREATE TABLE IF NOT EXISTS "tariffs" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR NOT NULL,
  "type" VARCHAR NOT NULL CHECK ("type" IN ('season_payment', 'monthly_payment')),
  "amount" DECIMAL(10, 2) NOT NULL,
  "season" INTEGER NOT NULL,
  "clubId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FK_tariffs_club" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE
);

-- Создание таблицы связи тарифов и мест
CREATE TABLE IF NOT EXISTS "tariff_berths" (
  "id" SERIAL PRIMARY KEY,
  "tariffId" INTEGER NOT NULL,
  "berthId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FK_tariff_berths_tariff" FOREIGN KEY ("tariffId") REFERENCES "tariffs"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_tariff_berths_berth" FOREIGN KEY ("berthId") REFERENCES "berths"("id") ON DELETE CASCADE,
  CONSTRAINT "UQ_tariff_berths" UNIQUE ("tariffId", "berthId")
);

-- Создание индексов
CREATE INDEX IF NOT EXISTS "IDX_tariffs_clubId" ON "tariffs"("clubId");
CREATE INDEX IF NOT EXISTS "IDX_tariff_berths_tariffId" ON "tariff_berths"("tariffId");
CREATE INDEX IF NOT EXISTS "IDX_tariff_berths_berthId" ON "tariff_berths"("berthId");

