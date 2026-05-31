import { NextFunction, Request, Response } from 'express'
import { httpRequestContext } from '../utils/requestContext'

export interface LifecycleRequest extends Request {
  abortSignal: AbortSignal
  clientClosed: boolean
}

/**
 * Отслеживает закрытие HTTP-соединения (уход со страницы / abort на клиенте).
 * Прерывает длинные цепочки SQL через assertClientConnected().
 */
export function requestLifecycle(req: Request, res: Response, next: NextFunction): void {
  const abortController = new AbortController()
  const lifecycleReq = req as LifecycleRequest
  lifecycleReq.abortSignal = abortController.signal
  lifecycleReq.clientClosed = false

  const onClose = (): void => {
    if (!res.writableFinished) {
      lifecycleReq.clientClosed = true
      abortController.abort()
    }
  }

  req.on('close', onClose)
  res.on('finish', () => req.removeListener('close', onClose))

  httpRequestContext.run(
    {
      abortSignal: abortController.signal,
      clientClosed: false,
    },
    () => {
      const ctx = httpRequestContext.getStore()
      if (!ctx) {
        next()
        return
      }

      abortController.signal.addEventListener('abort', () => {
        ctx.clientClosed = true
      })

      next()
    }
  )
}
