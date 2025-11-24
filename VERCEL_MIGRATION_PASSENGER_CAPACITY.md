# Применение миграции passengerCapacity на Vercel

## Проблема
Поле `passengerCapacity` добавлено в код, но на Vercel не применена миграция базы данных.

## Решение

### Вариант 1: Через Vercel CLI (рекомендуется)

1. Установите Vercel CLI (если еще не установлен):
```bash
npm i -g vercel
```

2. Войдите в Vercel:
```bash
vercel login
```

3. Примените миграцию через Vercel:
```bash
vercel env pull .env.local
npm run add-passenger-capacity
```

### Вариант 2: Через Vercel Dashboard

1. Откройте проект в Vercel Dashboard
2. Перейдите в Settings → Environment Variables
3. Убедитесь, что `DATABASE_URL` установлен
4. Перейдите в Deployments
5. Откройте последний deployment
6. В разделе "Functions" найдите функцию для выполнения миграции

### Вариант 3: Через SQL напрямую (Supabase)

Если используется Supabase:

1. Откройте Supabase Dashboard
2. Перейдите в SQL Editor
3. Выполните SQL:

```sql
-- Проверяем, существует ли колонка
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vessels' AND column_name = 'passengerCapacity';

-- Если колонки нет, добавляем её
ALTER TABLE vessels 
ADD COLUMN IF NOT EXISTS "passengerCapacity" INTEGER NOT NULL DEFAULT 1;

-- Удаляем значение по умолчанию (чтобы поле было обязательным для новых записей)
ALTER TABLE vessels 
ALTER COLUMN "passengerCapacity" DROP DEFAULT;

-- Обновляем существующие записи (если нужно)
UPDATE vessels 
SET "passengerCapacity" = 1 
WHERE "passengerCapacity" IS NULL;
```

### Вариант 4: Создать Vercel Serverless Function для миграции

Создайте файл `api/migrate-passenger-capacity.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DataSource } from 'typeorm';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Проверка секретного ключа для безопасности
  if (req.headers.authorization !== `Bearer ${process.env.MIGRATION_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Проверяем, существует ли колонка
    const columns = await queryRunner.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'vessels' AND column_name = 'passengerCapacity';
    `);

    if (columns.length === 0) {
      await queryRunner.query(`
        ALTER TABLE vessels 
        ADD COLUMN "passengerCapacity" INTEGER NOT NULL DEFAULT 1;
      `);
      
      await queryRunner.query(`
        ALTER TABLE vessels 
        ALTER COLUMN "passengerCapacity" DROP DEFAULT;
      `);
      
      await queryRunner.release();
      await dataSource.destroy();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Миграция применена успешно' 
      });
    } else {
      await queryRunner.release();
      await dataSource.destroy();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Колонка уже существует' 
      });
    }
  } catch (error: any) {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    return res.status(500).json({ 
      error: 'Ошибка миграции', 
      message: error.message 
    });
  }
}
```

Затем вызовите:
```bash
curl -X POST https://your-app.vercel.app/api/migrate-passenger-capacity \
  -H "Authorization: Bearer YOUR_MIGRATION_SECRET"
```

## Проверка

После применения миграции проверьте:

```sql
SELECT id, name, "passengerCapacity" FROM vessels LIMIT 5;
```

Все катера должны иметь значение `passengerCapacity`.

