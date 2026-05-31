import { useLayoutEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { abortInflightRequests } from '../utils/navigationAbort'

/**
 * Отменяет все in-flight HTTP и сбрасывает очередь при смене pathname.
 * Освобождает слоты пула БД на сервере, когда пользователь уходит со страницы.
 */
export function useAbortInflightOnNavigate(): void {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)

  useLayoutEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      abortInflightRequests()
      prevPathRef.current = location.pathname
    }
  }, [location.pathname])
}
