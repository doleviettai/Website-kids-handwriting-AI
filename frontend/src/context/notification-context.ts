import { createContext, useContext } from 'react'

export type NotificationContextValue = {
  unreadCount: number
  refresh: () => void
  setUnreadCount: (count: number) => void
}

export const NotificationContext = createContext<NotificationContextValue>({
  unreadCount: 0,
  refresh: () => {},
  setUnreadCount: () => {},
})

export function useNotificationContext() {
  return useContext(NotificationContext)
}
