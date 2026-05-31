/** Ограничивает параллельные HTTP-запросы — не даёт забить пул БД на сервере. */
const MAX_CONCURRENT = 2

type Waiter = {
  resolve: () => void
  reject: (error: Error) => void
  onAbort: () => void
}

class ApiQueue {
  private active = 0
  private waiters: Waiter[] = []

  async acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) {
      throw new DOMException('canceled', 'AbortError')
    }

    if (this.active < MAX_CONCURRENT) {
      this.active++
      return
    }

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.waiters.findIndex((w) => w.onAbort === onAbort)
        if (idx >= 0) {
          this.waiters.splice(idx, 1)
        }
        reject(new DOMException('canceled', 'AbortError'))
      }

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
      }

      this.waiters.push({ resolve, reject, onAbort })
    })
  }

  release(): void {
    this.active = Math.max(0, this.active - 1)
    this.drain()
  }

  /** При смене страницы — сбросить очередь и освободить слоты. */
  reset(): void {
    this.active = 0
    for (const waiter of this.waiters) {
      waiter.reject(new DOMException('canceled', 'AbortError'))
    }
    this.waiters = []
  }

  private drain(): void {
    while (this.active < MAX_CONCURRENT && this.waiters.length > 0) {
      const next = this.waiters.shift()
      if (!next) break
      this.active++
      next.resolve()
    }
  }
}

export const apiQueue = new ApiQueue()
