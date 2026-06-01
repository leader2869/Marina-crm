/** Контроллер отмены in-flight HTTP при смене страницы (SPA navigation). */
let navigationAbortController = new AbortController()

export function getNavigationAbortSignal(): AbortSignal {
  return navigationAbortController.signal
}

/** Отменить запросы без своего signal (страница ушла — освобождаем пул на сервере). */
export function abortInflightRequests(): void {
  navigationAbortController.abort()
  navigationAbortController = new AbortController()
}

export function mergeAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const active = signals.filter((s): s is AbortSignal => Boolean(s))
  if (active.length === 0) {
    return new AbortController().signal
  }
  if (active.some((s) => s.aborted)) {
    const aborted = new AbortController()
    aborted.abort()
    return aborted.signal
  }
  const merged = new AbortController()
  const onAbort = () => merged.abort()
  for (const signal of active) {
    signal.addEventListener('abort', onAbort, { once: true })
  }
  return merged.signal
}
