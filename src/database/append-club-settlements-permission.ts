import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/** Добавляет club_settlements в сохранённые права сотрудников (у кого permissions уже задан в БД). */
const appendClubSettlementsPermission = async (): Promise<void> => {
  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL || undefined,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    synchronize: false,
    logging: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ База данных подключена');

    const result = await dataSource.query(`
      UPDATE user_clubs
      SET permissions = permissions || '["club_settlements"]'::jsonb
      WHERE permissions IS NOT NULL
        AND NOT (permissions @> '"club_settlements"'::jsonb);
    `);

    console.log('✅ Право club_settlements добавлено существующим сотрудникам:', result);
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
};

void appendClubSettlementsPermission();
