import { useEffect } from 'react'
import type { DependencyList } from 'react'
import { isRequestAborted } from '../utils/request'

/**
 * Запускает effect с AbortSignal; при размонтировании или смене deps отменяет in-flight HTTP-запросы.
 */
export function useCancellableEffect(
  effect: (signal: AbortSignal) => void | Promise<void>,
  deps: DependencyList
) {
  useEffect(() => {
    const controller = new AbortController()

    void Promise.resolve(effect(controller.signal)).catch((error) => {
      if (!isRequestAborted(error)) {
        console.error(error)
      }
    })

    return () => controller.abort()
  }, deps)
}
