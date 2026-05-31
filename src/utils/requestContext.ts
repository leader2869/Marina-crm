import { AsyncLocalStorage } from 'node:async_hooks'

export type HttpRequestContext = {
  abortSignal: AbortSignal
  clientClosed: boolean
}

export const httpRequestContext = new AsyncLocalStorage<HttpRequestContext>()

export class ClientDisconnectedError extends Error {
  constructor() {
    super('Клиент отключился')
    this.name = 'ClientDisconnectedError'
  }
}

export function getRequestContext(): HttpRequestContext | undefined {
  return httpRequestContext.getStore()
}

export function assertClientConnected(): void {
  const ctx = getRequestContext()
  if (!ctx) return
  if (ctx.clientClosed || ctx.abortSignal.aborted) {
    throw new ClientDisconnectedError()
  }
}

/** Выполняет шаги последовательно; прерывает цепочку, если клиент ушёл со страницы. */
export async function runSequentialDb<T>(
  steps: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = []
  for (const step of steps) {
    assertClientConnected()
    results.push(await step())
  }
  return results
}
