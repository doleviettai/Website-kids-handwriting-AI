import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AppNotification, NotificationPage } from '../api/types'
import { useNotificationContext } from '../context/notification-context'
import { Icon } from './Icons'

function formatShortTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    })
  } catch {
    return ''
  }
}

export function NotificationBell() {
  const navigate = useNavigate()
  const { unreadCount, refresh, setUnreadCount } = useNotificationContext()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const reqIdRef = useRef(0)

  function toggleOpen() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setLoading(true)
    const reqId = ++reqIdRef.current
    void api
      .get<NotificationPage>('/notifications?page=0&unreadOnly=false')
      .then((res) => {
        if (reqId !== reqIdRef.current) return
        setItems(res.data.items.slice(0, 5))
        setUnreadCount(res.data.unreadCount)
      })
      .catch(() => {})
      .finally(() => {
        if (reqId === reqIdRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function openItem(notice: AppNotification) {
    setOpen(false)
    try {
      if (!notice.read) {
        await api.post(`/notifications/${notice.id}/read`)
        refresh()
      }
    } catch {
      /* Still navigate to submission if available. */
    }
    if (notice.submissionId != null) {
      navigate(`/bai-viet/${notice.submissionId}`)
    } else if (notice.type === 'TEACHER_REPORT') {
      navigate('/phu-huynh')
    } else if (
      notice.type === 'CLASS_INVITATION' ||
      notice.type === 'HOMEWORK_ASSIGNED' ||
      notice.type === 'HOMEWORK_GRADED'
    ) {
      navigate('/lop-hoc')
    } else if (notice.type === 'JOIN_REQUEST') {
      try {
        const res = await api.get<Array<{ id: number; name: string }>>(
          '/teacher/classrooms',
        )
        const matched =
          res.data.find((c) => notice.title.includes(c.name)) ?? res.data[0]
        if (matched) {
          navigate(`/giao-vien/lop/${matched.id}`)
          return
        }
      } catch {
        /* Fallback to notifications page below. */
      }
      navigate('/thong-bao')
    } else {
      navigate('/thong-bao')
    }
  }

  async function markAllRead() {
    try {
      await api.post('/notifications/read-all')
      setUnreadCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      /* Ignore transient error. */
    }
  }

  const badge = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : ''
  const label =
    unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'

  return (
    <div className="notification-bell-wrap" ref={wrapRef}>
      <button
        type="button"
        className="icon-button notification-bell-btn"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        onClick={toggleOpen}
      >
        <Icon name="bell" size={21} />
        {badge && <span className="notification-badge">{badge}</span>}
      </button>

      {open && (
        <div
          className="notification-popover panel"
          role="dialog"
          aria-label="Thông báo gần đây"
        >
          <div className="notification-popover-head">
            <strong>Thông báo</strong>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() => void markAllRead()}
              >
                Đọc tất cả
              </button>
            )}
          </div>

          {loading ? (
            <p className="notification-popover-empty">Đang tải thông báo...</p>
          ) : items.length === 0 ? (
            <p className="notification-popover-empty">
              Chưa có thông báo nào.
            </p>
          ) : (
            <ul className="notification-popover-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notification-popover-item ${item.read ? 'is-read' : 'is-unread'}`}
                    onClick={() => void openItem(item)}
                  >
                    <div className="notification-popover-title">
                      <span>{item.title}</span>
                      {!item.read && <i aria-hidden="true" />}
                    </div>
                    <p>{item.message}</p>
                    <small>{formatShortTime(item.createdAt)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="notification-popover-foot">
            <Link
              to="/thong-bao"
              className="text-button"
              onClick={() => setOpen(false)}
            >
              Xem tất cả thông báo
              <Icon name="arrow" size={15} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
