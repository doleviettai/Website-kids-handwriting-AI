import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiError } from '../api/client'
import { useResource } from '../hooks/useResource'
import { useAuth } from '../context/auth-context'
import type { SubmissionComment, SubmissionDetail } from '../api/types'
import { ErrorPanel, Loading } from '../components/Feedback'
import { SubmissionResult } from '../components/SubmissionResult'
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

export function SubmissionDetailPage() {
  const { submissionId } = useParams()
  const { user } = useAuth()
  const result = useResource<SubmissionDetail>(`/submissions/${submissionId}`)
  const comments = useResource<SubmissionComment[]>(
    submissionId ? `/submissions/${submissionId}/comments` : null,
  )

  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  async function submitComment(event: React.FormEvent) {
    event.preventDefault()
    if (!submissionId || sending || !content.trim()) return
    setSending(true)
    setSendError('')
    try {
      await api.post(`/admin/submissions/${submissionId}/comments`, {
        content: content.trim(),
      })
      setContent('')
      comments.reload()
    } catch (failure) {
      setSendError(apiError(failure))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="page-enter">
      <Link to="/" className="back-link">
        ← Về trang chính
      </Link>
      {result.loading ? (
        <Loading message="Đang tải bài viết..." />
      ) : result.error ? (
        <ErrorPanel message={result.error} onRetry={result.reload} />
      ) : (
        result.data && (
          <>
            <SubmissionResult result={result.data} />
            <section
              className="panel submission-comments-section"
              aria-label="Nhận xét bài viết"
            >
              <div className="section-heading">
                <div>
                  <span className="eyebrow">PHẢN HỒI BỔ SUNG</span>
                  <h2>Nhận xét từ quản trị viên</h2>
                </div>
              </div>

              {comments.loading ? (
                <Loading message="Đang tải nhận xét..." />
              ) : comments.error ? (
                <ErrorPanel
                  message={comments.error}
                  onRetry={comments.reload}
                />
              ) : !comments.data?.length ? (
                <p className="empty-inline-note">
                  Chưa có nhận xét nào cho bài viết này.
                </p>
              ) : (
                <ul className="comment-list">
                  {comments.data.map((comment) => (
                    <li key={comment.id} className="comment-item">
                      <div className="comment-head">
                        <strong>{comment.authorName}</strong>
                        <small>{formatTime(comment.createdAt)}</small>
                      </div>
                      <p>{comment.content}</p>
                    </li>
                  ))}
                </ul>
              )}

              {user?.role === 'ADMIN' && (
                <form
                  className="comment-form"
                  onSubmit={(e) => void submitComment(e)}
                >
                  <label htmlFor="admin-comment-input">
                    Viết nhận xét gửi phụ huynh
                  </label>
                  <textarea
                    id="admin-comment-input"
                    rows={3}
                    maxLength={1000}
                    value={content}
                    disabled={sending}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập lời động viên hoặc góp ý chi tiết cho ba mẹ và bé..."
                  />
                  <div className="comment-form-foot">
                    <small>{content.length} / 1000 ký tự</small>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={sending || !content.trim()}
                    >
                      {sending ? 'Đang gửi...' : 'Gửi nhận xét'}
                      <Icon name="check" size={17} />
                    </button>
                  </div>
                  {sendError && (
                    <p role="alert" className="form-error">
                      {sendError}
                    </p>
                  )}
                </form>
              )}
            </section>
          </>
        )
      )}
    </div>
  )
}
