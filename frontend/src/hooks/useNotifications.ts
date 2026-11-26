import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type { UnreadCount } from '../api/types'

export function useNotifications(enabled: boolean, routeKey: string) {
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(() => {
    if (!enabled) return
    void api
      .get<UnreadCount>('/notifications/unread-count')
      .then((res) => setUnreadCount(res.data.unreadCount))
      .catch(() => {
        /* Ignore background polling errors. */
      })
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    let active = true
    const fetchCount = () => {
      void api
        .get<UnreadCount>('/notifications/unread-count')
        .then((res) => {
          if (active) setUnreadCount(res.data.unreadCount)
        })
        .catch(() => {})
    }
    fetchCount()
    const onFocus = () => fetchCount()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(fetchCount, 60000)
    return () => {
      active = false
      window.removeEventListener('focus', onFocus)
      window.clearInterval(timer)
    }
  }, [enabled, routeKey])

  return { unreadCount: enabled ? unreadCount : 0, refresh, setUnreadCount }
}
