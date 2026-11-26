import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiError } from '../api/client'
import type { AppNotification, NotificationPage } from '../api/types'
import { useResource } from '../hooks/useResource'
import { useNotificationContext } from '../context/notification-context'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Mascot } from '../components/Artwork'
import { Icon } from '../components/Icons'

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const { refresh, setUnreadCount } = useNotificationContext()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const [busyAll, setBusyAll] = useState(false)
  const [actionError, setActionError] = useState('')

  const data = useResource<NotificationPage>(
    `/notifications?page=${page}&unreadOnly=${unreadOnly}`,
  )

  async function openNotification(item: AppNotification) {
    setActionError('')
    try {
      if (!item.read) {
        await api.post(`/notifications/${item.id}/read`)
        refresh()
        data.reload()
      }
      if (item.submissionId != null) {
        navigate(`/bai-viet/${item.submissionId}`)
      }
    } catch (failure) {
      setActionError(apiError(failure))
    }
  }

  async function markOneRead(item: AppNotification) {
    if (item.read) return
    setActionError('')
    try {
      await api.post(`/notifications/${item.id}/read`)
      refresh()
      data.reload()
    } catch (failure) {
      setActionError(apiError(failure))
    }
  }

  async function markAllRead() {
    if (busyAll) return
    setBusyAll(true)
    setActionError('')
    try {
      await api.post('/notifications/read-all')
      setUnreadCount(0)
      data.reload()
    } catch (failure) {
      setActionError(apiError(failure))
    } finally {
      setBusyAll(false)
    }
  }

  const unread = data.data?.unreadCount ?? 0

  return (
    <div className="page-enter">
      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">THÔNG BÁO</span>
          <h1>Thông báo bài viết</h1>
          <p>
            Theo dõi các bài cần xem lại và nhận xét mới từ quản trị viên.
          </p>
        </div>
        <button
          className="soft-button"
          disabled={busyAll || unread === 0}
          onClick={() => void markAllRead()}
        >
          <Icon name="check" size={17} />
          {busyAll ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
        </button>
      </header>

      <div className="notification-toolbar">
        <div className="notification-filter-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={!unreadOnly}
            className={!unreadOnly ? 'primary-button' : 'soft-button'}
            onClick={() => {
              setUnreadOnly(false)
              setPage(0)
            }}
          >
            Tất cả
          </button>
          <button
            role="tab"
            aria-selected={unreadOnly}
            className={unreadOnly ? 'primary-button' : 'soft-button'}
            onClick={() => {
              setUnreadOnly(true)
              setPage(0)
            }}
          >
            Chưa đọc ({unread})
          </button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="form-error">
          {actionError}
        </p>
      )}

      {data.loading ? (
        <Loading message="Đang tải thông báo..." />
      ) : data.error ? (
        <ErrorPanel message={data.error} onRetry={data.reload} />
      ) : !data.data || data.data.items.length === 0 ? (
        <div className="empty-state panel">
          <Mascot />
          <h2>
            {unreadOnly
              ? 'Không còn thông báo chưa đọc!'
              : 'Chưa có thông báo nào'}
          </h2>
          <p>
            {unreadOnly
              ? 'Bạn đã xem hết các thông báo rồi.'
              : 'Khi có bài cần xem lại hoặc nhận xét mới, Pip sẽ báo ngay tại đây.'}
          </p>
        </div>
      ) : (
        <>
          <div className="notification-list">
            {data.data.items.map((item) => (
              <article
                key={item.id}
                className={`panel notification-card ${item.read ? 'is-read' : 'is-unread'}`}
              >
                <button
                  type="button"
                  className="notification-card-main"
                  onClick={() => void openNotification(item)}
                >
                  <div className="notification-card-icon">
                    <Icon
                      name={item.type === 'NEW_COMMENT' ? 'heart' : 'bell'}
                      size={20}
                    />
                  </div>
                  <div className="notification-card-body">
                    <div className="notification-card-head">
                      <strong>{item.title}</strong>
                      {!item.read && (
                        <span className="notification-unread-badge">Mới</span>
                      )}
                    </div>
                    <p>{item.message}</p>
                    <small>{formatTime(item.createdAt)}</small>
                  </div>
                </button>
                <div className="notification-card-actions">
                  {!item.read && (
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => void markOneRead(item)}
                    >
                      Đã đọc
                    </button>
                  )}
                  {item.submissionId != null && (
                    <button
                      type="button"
                      className="soft-button"
                      onClick={() => void openNotification(item)}
                    >
                      Xem bài viết
                      <Icon name="arrow" size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {data.data.totalPages > 1 && (
            <div className="pagination-bar">
              <button
                className="soft-button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Trang trước
              </button>
              <span>
                Trang {page + 1} / {data.data.totalPages}
              </span>
              <button
                className="soft-button"
                disabled={page + 1 >= data.data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Trang sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
