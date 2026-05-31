#!/usr/bin/env node
/**
 * Завершает idle-сессии postgres старше minAgeMinutes (зомби от Vercel/Supavisor).
 * Запуск на VPS: node scripts/vps/kill-zombie-db-sessions.js
 */
require('dotenv').config();
const { Client } = require('pg');

const minAgeMinutes = parseInt(process.env.ZOMBIE_MIN_AGE_MIN || '5', 10);

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    statement_timeout: 15000,
  });

  await c.connect();

  const { rows } = await c.query(
    `
    SELECT pid
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND usename = 'postgres'
      AND state = 'idle'
      AND application_name = 'Supavisor'
      AND now() - state_change > ($1 || ' minutes')::interval
      AND pid <> pg_backend_pid()
    `,
    [String(minAgeMinutes)]
  );

  console.log(`Found ${rows.length} zombie session(s) idle > ${minAgeMinutes} min`);

  let killed = 0;
  for (const { pid } of rows) {
    try {
      const k = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000,
        query_timeout: 10000,
        statement_timeout: 10000,
      });
      await k.connect();
      await k.query('SELECT pg_terminate_backend($1)', [pid]);
      await k.end();
      console.log('Terminated pid', pid);
      killed++;
    } catch (e) {
      console.warn('Failed pid', pid, e.message);
    }
  }

  const after = await c.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE usename='postgres' AND state='idle') AS pg_idle
    FROM pg_stat_activity WHERE datname = current_database()
  `);
  console.log('After cleanup:', after.rows[0], 'killed:', killed);
  await c.end();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
