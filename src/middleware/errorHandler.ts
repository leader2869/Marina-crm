import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Логируем ошибку для отладки
  console.error('[ErrorHandler]', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    isAppError: err instanceof AppError,
  });

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Внутренняя ошибка сервера';

  // Для Vercel возвращаем стандартный формат ошибки
  if (process.env.VERCEL) {
    res.status(statusCode).json({
      error: {
        code: statusCode.toString(),
        message: message,
      },
    });
  } else {
    res.status(statusCode).json({
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
};



