import { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { abortInflightRequests } from '../utils/navigationAbort'

/**
 * Синхронно отменяет in-flight API при смене pathname (до mount/effects новой страницы).
 */
export function useAbortInflightOnNavigate(): void {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)

  if (prevPathRef.current !== location.pathname) {
    abortInflightRequests()
    prevPathRef.current = location.pathname
  }
}
