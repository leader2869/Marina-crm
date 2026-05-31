import axios from 'axios'

export type RequestOptions = {
  signal?: AbortSignal
  params?: Record<string, string | number | boolean | undefined>
}

export function isRequestAborted(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; name?: string; message?: string }
  if (e.code === 'ERR_CANCELED' || e.name === 'CanceledError' || e.name === 'AbortError') {
    return true
  }
  if (axios.isCancel(error)) return true
  if (typeof e.message === 'string' && e.message.toLowerCase().includes('canceled')) {
    return true
  }
  return false
}
