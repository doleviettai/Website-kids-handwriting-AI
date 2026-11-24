import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { FormEvent } from 'react'
import type { ErrorType } from '../../api/types'
import { api, apiError } from '../../api/client'
import { useResource } from '../../hooks/useResource'
import { Modal } from '../../components/Modal'
import { DeleteDialog } from '../../components/DeleteDialog'
import { Icon } from '../../components/Icons'
import { ErrorPanel, Loading } from '../../components/Feedback'

function ErrorEditor({
  errorType,
  onClose,
  onSaved,
}: {
  errorType: ErrorType | null
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [feedback, setFeedback] = useState(errorType?.feedbackTemplateVi ?? '')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const payload = {
      code: String(data.get('code')).trim().toUpperCase(),
      nameVi: String(data.get('nameVi')).trim().normalize('NFC'),
      feedbackTemplateVi: feedback.trim().normalize('NFC'),
    }
    if (!payload.nameVi || !payload.feedbackTemplateVi) {
      setError('Nhập đầy đủ tên lỗi và phản hồi tiếng Việt.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (errorType)
        await api.put(`/admin/error-types/${errorType.id}`, payload)
      else await api.post('/admin/error-types', payload)
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={errorType ? 'Chỉnh sửa loại lỗi' : 'Thêm loại lỗi mới'}
      busy={busy}
      onClose={onClose}
    >
      <p className="dialog-intro">
        Lời góp ý nên ngắn gọn, cụ thể và khích lệ để bé tự tin luyện tập.
      </p>
      <form className="account-form" onSubmit={save}>
        <label>
          Mã lỗi
          <input
            name="code"
            aria-label="Mã lỗi"
            required
            pattern="[A-Z][A-Z0-9_]{0,49}"
            maxLength={50}
            defaultValue={errorType?.code ?? ''}
            placeholder="Ví dụ: WRONG_SPACING"
            disabled={busy}
          />
          <small>Chữ in hoa, số và dấu gạch dưới; bắt đầu bằng chữ.</small>
        </label>
        <label>
          Tên lỗi tiếng Việt
          <input
            name="nameVi"
            required
            maxLength={150}
            defaultValue={errorType?.nameVi ?? ''}
            placeholder="Ví dụ: Khoảng cách chưa đều"
            disabled={busy}
          />
        </label>
        <label>
          Mẫu phản hồi tiếng Việt
          <textarea
            name="feedbackTemplateVi"
            aria-label="Mẫu phản hồi tiếng Việt"
            required
            maxLength={5000}
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Bé thử chừa khoảng cách đều hơn giữa các chữ nhé!"
            disabled={busy}
          />
        </label>
        <div className="feedback-preview">
          <span>
            <Icon name="heart" size={17} /> Bé sẽ đọc được
          </span>
          <p>{feedback.trim() || 'Phản hồi của bạn sẽ hiển thị tại đây.'}</p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="soft-button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu loại lỗi'}
            <Icon name="check" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AdminErrorsPage() {
  const errors = useResource<ErrorType[]>('/admin/error-types')
  const [editing, setEditing] = useState<ErrorType | 'new' | null>(null),
    [deleting, setDeleting] = useState<ErrorType | null>(null)
  const [query, setQuery] = useSearchParams()
  const search = query.get('q') ?? ''
  const [notice, setNotice] = useState('')
  function setSearch(value: string) {
    const next = new URLSearchParams(query)
    if (value) next.set('q', value)
    else next.delete('q')
    setQuery(next, { replace: true })
  }
  const rows =
    errors.data?.filter((e) =>
      `${e.code} ${e.nameVi} ${e.feedbackTemplateVi}`
        .toLocaleLowerCase('vi')
        .includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? []
  return (
    <div className="page-enter admin-content-page">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">GÓP Ý NHỎ, TỰ TIN THÊM</span>
          <h1>Loại lỗi & phản hồi</h1>
          <p>
            Chuẩn bị các lỗi và lời nhắn tiếng Việt để dùng khi hệ thống đánh
            giá bài viết được kết nối.
          </p>
        </div>
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Icon name="heart" size={19} /> Thêm loại lỗi
        </button>
      </div>
      {notice && (
        <p className="success-notice" role="status">
          <Icon name="check" size={18} />
          {notice}
        </p>
      )}
      <div className="admin-filters">
        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            aria-label="Tìm loại lỗi"
            placeholder="Tìm mã lỗi, tên hoặc phản hồi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <button className="text-button" onClick={errors.reload}>
          Làm mới
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {errors.loading ? (
        <Loading message="Đang tải loại lỗi..." />
      ) : errors.error ? (
        <ErrorPanel message={errors.error} onRetry={errors.reload} />
      ) : (
        <div className="error-type-grid">
          {rows.map((errorType) => (
            <article className="panel error-type-card" key={errorType.id}>
              <span className="error-code">{errorType.code}</span>
              <h2>{errorType.nameVi}</h2>
              <div className="feedback-preview">
                <span>
                  <Icon name="heart" size={16} /> Lời nhắn cho bé
                </span>
                <p>{errorType.feedbackTemplateVi}</p>
              </div>
              <div className="admin-card-actions">
                <button
                  className="soft-button"
                  onClick={() => setEditing(errorType)}
                  aria-label={`Sửa loại lỗi ${errorType.code}`}
                >
                  <Icon name="pen" size={17} /> Chỉnh sửa
                </button>
                <button
                  className="icon-button"
                  aria-label={`Xóa loại lỗi ${errorType.code}`}
                  onClick={() => setDeleting(errorType)}
                >
                  <Icon name="trash" size={17} />
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <div className="empty-state panel">
              <Icon name="heart" size={38} />
              <h3>Chưa có loại lỗi phù hợp</h3>
              <p>Thử từ khóa khác hoặc thêm một loại lỗi mới.</p>
            </div>
          )}
        </div>
      )}
      {editing && (
        <ErrorEditor
          errorType={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            errors.reload()
            setNotice('Đã lưu loại lỗi và mẫu phản hồi.')
          }}
        />
      )}{' '}
      {deleting && (
        <DeleteDialog
          title={`Xóa loại lỗi ${deleting.code}?`}
          description="Chỉ xóa được loại lỗi chưa được dùng trong bài viết. Nếu lỗi đã có trong lịch sử, bạn có thể chỉnh tên hoặc phản hồi thay vì xóa."
          url={`/admin/error-types/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            errors.reload()
            setNotice('Đã xóa loại lỗi.')
          }}
        />
      )}
    </div>
  )
}
