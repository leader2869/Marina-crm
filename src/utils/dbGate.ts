import { getPgPoolMax } from '../config/database'

type ReleaseFn = () => void

type Waiter = {
  resolve: (release: ReleaseFn) => void
  reject: (error: Error) => void
  onAbort: () => void
}

class DbGate {
  private active = 0
  private readonly max: number
  private waiters: Waiter[] = []

  constructor(max: number) {
    this.max = Math.max(1, max)
  }

  acquire(signal?: AbortSignal): Promise<ReleaseFn> {
    if (signal?.aborted) {
      return Promise.reject(new Error('DB gate: client aborted'))
    }

    const release = (): void => {
      this.active = Math.max(0, this.active - 1)
      this.drain()
    }

    if (this.active < this.max) {
      this.active++
      return Promise.resolve(release)
    }

    return new Promise<ReleaseFn>((resolve, reject) => {
      const onAbort = () => {
        const idx = this.waiters.findIndex((w) => w.onAbort === onAbort)
        if (idx >= 0) {
          this.waiters.splice(idx, 1)
        }
        reject(new Error('DB gate: client aborted'))
      }

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true })
      }

      this.waiters.push({
        resolve: (releaseFn) => resolve(releaseFn),
        reject,
        onAbort,
      })
    })
  }

  private drain(): void {
    while (this.active < this.max && this.waiters.length > 0) {
      const next = this.waiters.shift()
      if (!next) break
      this.active++
      next.resolve(() => {
        this.active = Math.max(0, this.active - 1)
        this.drain()
      })
    }
  }
}

export const dbGate = new DbGate(getPgPoolMax())
