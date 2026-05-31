import { NextFunction, Request, Response } from 'express'
import { dbGate } from '../utils/dbGate'
import { ClientDisconnectedError } from '../utils/requestContext'
import { LifecycleRequest } from './requestLifecycle'

/**
 * Ограничивает число одновременных API-обработчиков = PG_POOL_MAX.
 * Слот освобождается при finish/close — клиент ушёл со страницы, пул не блокируется.
 */
export function dbRequestGate(req: Request, res: Response, next: NextFunction): void {
  const lifecycleReq = req as LifecycleRequest
  let released = false
  let release: (() => void) | undefined

  const releaseSlot = (): void => {
    if (released) return
    released = true
    release?.()
  }

  dbGate
    .acquire(lifecycleReq.abortSignal)
    .then((releaseFn) => {
      release = releaseFn

      if (lifecycleReq.clientClosed || lifecycleReq.abortSignal.aborted) {
        releaseSlot()
        return
      }

      res.once('finish', releaseSlot)
      req.once('close', releaseSlot)
      next()
    })
    .catch((error) => {
      if (error instanceof Error && error.message.includes('client aborted')) {
        return
      }
      next(error)
    })
}

export function ignoreClientDisconnect(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ClientDisconnectedError) {
    if (!res.headersSent) {
      res.end()
    }
    return
  }
  next(err)
}
