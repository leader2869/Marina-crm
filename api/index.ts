// Vercel serverless function entry point
// This file is used by Vercel to handle API requests only
import { Request, Response } from 'express';
import app from '../src/server';

// Handler для Vercel
// ВАЖНО: Vercel вызывает этот handler для всех маршрутов, которые не соответствуют статическим файлам
// Но rewrites должны применяться ПЕРЕД вызовом serverless functions
// Если запрос не на /api/* или /health, то это ошибка конфигурации
export default (req: Request, res: Response) => {
  // Логируем для отладки
  console.log(`[Vercel Handler] ${req.method} ${req.url}`);
  
  // Обрабатываем через Express app
  // Express app сам проверит маршруты и вернет 404 для несуществующих
  return app(req, res);
};

