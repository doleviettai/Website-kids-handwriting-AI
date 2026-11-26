import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiError } from '../../api/client'
import type {
  EvaluationRating,
  HomeworkDetail,
  HomeworkPage,
  HomeworkSubmissionRow,
} from '../../api/types'
import { gradeLabels, subjectLabels } from '../../data'
import { useResource } from '../../hooks/useResource'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { AuthImage } from '../../components/AuthImage'
import { Icon } from '../../components/Icons'

type FilterKey = 'ALL' | 'SUBMITTED' | 'UNGRADED' | 'GRADED'

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
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

function isRowGraded(row: HomeworkSubmissionRow) {
  return (
    row.score !== null ||
    row.rating !== null ||
    Boolean(row.teacherComment && row.teacherComment.trim().length > 0)
  )
}

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim()
}

export function TeacherHomeworkPage() {
  const { batchId } = useParams()
  const detail = useResource<HomeworkDetail>(
    batchId ? `/teacher/homework/${batchId}` : null,
  )
  const [zoomPage, setZoomPage] = useState<HomeworkPage | null>(null)
  const [filter, setFilter] = useState<FilterKey>('ALL')
  const [search, setSearch] = useState('')
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showAiBatchModal, setShowAiBatchModal] = useState(false)
  const [banner, setBanner] = useState('')

  if (detail.loading) return <Loading message="Đang mở đợt bài tập..." />
  if (detail.error)
    return <ErrorPanel message={detail.error} onRetry={detail.reload} />
  if (!detail.data) return null

  const hw = detail.data
  const totalCount = hw.rows.length
  const submittedRows = hw.rows.filter((r) => r.pages.length > 0)
  const unsubmittedRows = hw.rows.filter((r) => r.pages.length === 0)
  const gradedCount = hw.rows.filter(isRowGraded).length
  const ungradedCount = totalCount - gradedCount
  const sentCount = hw.rows.filter((r) => r.sentToParentAt !== null).length

  const needle = normalizeSearch(search)
  const visibleRows = hw.rows.filter((row) => {
    if (filter === 'SUBMITTED' && row.pages.length === 0) return false
    if (filter === 'GRADED' && !isRowGraded(row)) return false
    if (filter === 'UNGRADED' && isRowGraded(row)) return false
    if (!needle) return true
    const haystack = normalizeSearch(
      `${row.displayName} ${row.parentName ?? ''} ${row.parentEmail ?? ''}`,
    )
    return haystack.includes(needle)
  })

  return (
    <div className="page-enter">
      <Link to={`/giao-vien/lop/${hw.classroomId}`} className="back-link">
        ← Về lớp {hw.classroomName}
      </Link>

      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {subjectLabels[hw.subject]} · {hw.classroomName} ·{' '}
            {gradeLabels[hw.gradeLevel]}
          </span>
          <h1>{hw.title}</h1>
          {hw.description && <p className="hw-description">{hw.description}</p>}
          <p className="hw-meta">
            Yêu cầu: <strong>{hw.requiredPages} trang ảnh</strong>
            {hw.dueAt ? ` · Hạn nộp: ${formatDateTime(hw.dueAt)}` : ''}
          </p>
        </div>
        <Link
          to={`/giao-vien/lop/${hw.classroomId}/bang-diem`}
          className="soft-button"
        >
          Xem bảng điểm lớp
          <Icon name="chart" size={17} />
        </Link>
      </header>

      <section className="panel hw-toolbar">
        <div className="hw-toolbar-top">
          <div className="hw-summary-pills">
            <span className="hw-stat-pill">
              Đã nộp ảnh: <strong>{submittedRows.length}/{totalCount}</strong>
            </span>
            <span className="hw-stat-pill is-graded">
              Đã chấm: <strong>{gradedCount}/{totalCount}</strong>
            </span>
            <span className="hw-stat-pill is-pending">
              Chưa chấm: <strong>{ungradedCount}</strong>
            </span>
            <span className="hw-stat-pill is-sent">
              Đã gửi PH: <strong>{sentCount}</strong>
            </span>
          </div>
          <div className="hw-toolbar-actions">
            <button
              type="button"
              className="ai-button"
              onClick={() => setShowAiBatchModal(true)}
            >
              <Icon name="sparkles" size={17} />
              Chấm nhanh bằng AI
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowPublishModal(true)}
            >
              Gửi điểm cho cả lớp
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        <div className="hw-filter-row">
          <div className="hw-filter-tabs" role="tablist" aria-label="Lọc bài nộp">
            {(
              [
                ['ALL', `Tất cả (${totalCount})`],
                ['SUBMITTED', `Đã nộp ảnh (${submittedRows.length})`],
                ['UNGRADED', `Chưa chấm (${ungradedCount})`],
                ['GRADED', `Đã chấm (${gradedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={filter === key}
                className={filter === key ? 'is-active' : ''}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="search-field hw-search-field">
            <Icon name="search" size={16} />
            <input
              type="search"
              aria-label="Tìm tên học sinh"
              placeholder="Tìm tên học sinh, phụ huynh..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {banner && (
          <p role="status" className="form-success">
            {banner}
          </p>
        )}
      </section>

      {visibleRows.length === 0 ? (
        <div className="panel hw-empty-filter">
          <p>Không có học sinh nào trong bộ lọc này.</p>
        </div>
      ) : (
        <div className="hw-submissions-list">
          {visibleRows.map((row) => (
            <StudentHomeworkCard
              key={row.enrollmentId}
              batchId={hw.batchId}
              row={row}
              onZoom={setZoomPage}
              onSaved={detail.reload}
            />
          ))}
        </div>
      )}

      {showPublishModal && (
        <PublishClassModal
          batchId={hw.batchId}
          totalCount={totalCount}
          gradedCount={gradedCount}
          ungradedCount={ungradedCount}
          sentCount={sentCount}
          onClose={() => setShowPublishModal(false)}
          onDone={(msg) => {
            setShowPublishModal(false)
            setBanner(msg)
            detail.reload()
          }}
        />
      )}

      {showAiBatchModal && (
        <AiBatchGradeModal
          submittedCount={submittedRows.length}
          unsubmittedNames={unsubmittedRows.map((r) => r.displayName)}
          onClose={() => setShowAiBatchModal(false)}
        />
      )}

      {zoomPage && (
        <Modal
          title={`Trang ${zoomPage.pageNumber} — ${zoomPage.originalFilename}`}
          onClose={() => setZoomPage(null)}
        >
          <div className="hw-zoom-wrap">
            <AuthImage
              url={zoomPage.imageUrl}
              alt={zoomPage.originalFilename}
              className="hw-zoom-img"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}

function PublishClassModal({
  batchId,
  totalCount,
  gradedCount,
  ungradedCount,
  sentCount,
  onClose,
  onDone,
}: {
  batchId: number
  totalCount: number
  gradedCount: number
  ungradedCount: number
  sentCount: number
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [mode, setMode] = useState<'NOW' | 'SCHEDULE'>('NOW')
  const [scheduleAt, setScheduleAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (busy) return
    if (gradedCount === 0) {
      setError('Chưa có học sinh nào được chấm điểm để gửi cho phụ huynh.')
      return
    }
    if (mode === 'SCHEDULE' && !scheduleAt) {
      setError('Cô vui lòng chọn ngày và giờ hẹn gửi điểm.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const sendNow = mode === 'NOW'
      const res = await api.post<{
        sentCount: number
        skippedUnlinked: number
        skippedEmpty: number
      }>(`/teacher/homework/${batchId}/schedule-send`, {
        sendNow,
        scheduledSendAt: sendNow ? null : `${scheduleAt}:00`,
      })
      onDone(
        sendNow
          ? `Đã gửi điểm ngay cho ${res.data.sentCount} phụ huynh (bỏ qua ${res.data.skippedEmpty} bài chưa chấm).`
          : `Đã hẹn giờ gửi điểm lúc ${formatDateTime(scheduleAt)} cho ${res.data.sentCount} bài đã chấm.`,
      )
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Gửi điểm cho cả lớp" busy={busy} onClose={onClose}>
      <div className="hw-publish-stats">
        <div className="hw-publish-stat is-ok">
          <span>Đã chấm</span>
          <strong>
            {gradedCount}/{totalCount}
          </strong>
        </div>
        <div className="hw-publish-stat is-warn">
          <span>Chưa chấm</span>
          <strong>{ungradedCount}</strong>
        </div>
        <div className="hw-publish-stat">
          <span>Đã gửi trước đó</span>
          <strong>{sentCount}</strong>
        </div>
      </div>

      {ungradedCount > 0 && (
        <p className="hw-publish-note">
          Các học sinh chưa chấm ({ungradedCount} em) sẽ được bỏ qua, chỉ gửi
          kết quả cho các bài đã chấm.
        </p>
      )}

      <div className="hw-mode-group">
        <label className={`hw-radio-card ${mode === 'NOW' ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name="publishMode"
            checked={mode === 'NOW'}
            onChange={() => setMode('NOW')}
          />
          <div>
            <strong>Gửi luôn cho phụ huynh</strong>
            <small>Phụ huynh nhận thông báo và xem điểm ngay lập tức.</small>
          </div>
        </label>

        <label
          className={`hw-radio-card ${mode === 'SCHEDULE' ? 'is-selected' : ''}`}
        >
          <input
            type="radio"
            name="publishMode"
            checked={mode === 'SCHEDULE'}
            onChange={() => setMode('SCHEDULE')}
          />
          <div>
            <strong>Chọn mốc thời gian khác</strong>
            <small>Hệ thống tự động gửi đồng loạt vào thời điểm cô chọn.</small>
          </div>
        </label>
      </div>

      {mode === 'SCHEDULE' && (
        <label className="hw-field hw-schedule-field">
          <span>Thời gian gửi điểm</span>
          <input
            type="datetime-local"
            value={scheduleAt}
            disabled={busy}
            onChange={(e) => setScheduleAt(e.target.value)}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="form-error">
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
          Đóng
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={busy || gradedCount === 0}
          onClick={() => void submit()}
        >
          {busy
            ? 'Đang xử lý...'
            : mode === 'NOW'
              ? `Gửi ngay (${gradedCount} bài)`
              : `Xác nhận hẹn giờ (${gradedCount} bài)`}
        </button>
      </div>
    </Modal>
  )
}

function AiBatchGradeModal({
  submittedCount,
  unsubmittedNames,
  onClose,
}: {
  submittedCount: number
  unsubmittedNames: string[]
  onClose: () => void
}) {
  return (
    <Modal title="Chấm nhanh cả lớp bằng AI" onClose={onClose}>
      <div className="hw-publish-stats">
        <div className="hw-publish-stat is-ok">
          <span>Đã nộp ảnh (sẵn sàng)</span>
          <strong>{submittedCount}</strong>
        </div>
        <div className="hw-publish-stat is-warn">
          <span>Chưa nộp bài</span>
          <strong>{unsubmittedNames.length}</strong>
        </div>
      </div>

      <div className="hw-ai-status-box">
        <strong>Trạng thái tích hợp Model AI chấm ảnh vở (V5+Kids)</strong>
        <p>
          Model chấm trình bày & nét viết trên ảnh chụp vở đang được huấn luyện
          và chuẩn bị xuất checkpoint ONNX (Pha 3). Hệ thống{' '}
          <strong>không sinh điểm giả</strong> khi chưa có model thật.
        </p>
        <p>
          Sau khi nối checkpoint vào <code>ai-server</code>, bấm nút này sẽ tự
          động chấm toàn bộ <strong>{submittedCount} bài đã nộp</strong> (điền
          sẵn điểm 0–10, xếp loại và nhận xét để cô kiểm tra lại), đồng thời báo
          rõ <strong>{unsubmittedNames.length} học sinh chưa nộp bài</strong>.
        </p>
      </div>

      {unsubmittedNames.length > 0 && (
        <div className="hw-unsubmitted-list">
          <span>Danh sách chưa nộp ảnh ({unsubmittedNames.length}):</span>
          <p>{unsubmittedNames.join(', ')}</p>
        </div>
      )}

      <div className="dialog-actions">
        <button type="button" className="primary-button" onClick={onClose}>
          Đã hiểu
        </button>
      </div>
    </Modal>
  )
}

function StudentHomeworkCard({
  batchId,
  row,
  onZoom,
  onSaved,
}: {
  batchId: number
  row: HomeworkSubmissionRow
  onZoom: (p: HomeworkPage) => void
  onSaved: () => void
}) {
  const [score, setScore] = useState(row.score == null ? '' : String(row.score))
  const [rating, setRating] = useState<EvaluationRating | ''>(row.rating ?? '')
  const [comment, setComment] = useState(row.teacherComment ?? '')
  const [needsAttention, setNeedsAttention] = useState(row.needsAttention)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [aiNote, setAiNote] = useState('')

  const graded = isRowGraded(row)

  async function saveDraft() {
    if (busy) return
    setBusy(true)
    setMsg('')
    setErr('')
    setAiNote('')
    try {
      await api.put(
        `/teacher/homework/${batchId}/enrollments/${row.enrollmentId}/grade`,
        {
          score: score.trim() === '' ? null : Number(score),
          rating: rating === '' ? null : rating,
          teacherComment: comment.trim() || null,
          needsAttention,
          gradingMode: 'MANUAL',
          sendNow: false,
          scheduledSendAt: null,
        },
      )
      setMsg('Đã lưu điểm đánh giá. Cô có thể bấm “Gửi điểm cho cả lớp” ở trên khi chấm xong.')
      onSaved()
    } catch (failure) {
      setErr(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  function handleSingleAiClick() {
    setMsg('')
    setErr('')
    if (row.pages.length === 0) {
      setAiNote('Học sinh này chưa nộp ảnh bài làm nên AI chưa thể chấm.')
      return
    }
    setAiNote(
      `Đã ghi nhận ${row.pages.length} trang ảnh nộp. Model AI chấm ảnh vở V5+Kids đang hoàn thiện (Pha 3) nên chưa tự điền điểm cho bài này.`,
    )
  }

  return (
    <article
      className={`panel hw-student-card ${graded ? 'is-graded' : ''} ${row.needsAttention ? 'is-attention' : ''}`}
    >
      <div className="hw-student-head">
        <div className="hw-student-identity">
          <div className="hw-student-title-row">
            <h3>{row.displayName}</h3>
            {row.score !== null && (
              <span className="hw-score-chip">{row.score} đ</span>
            )}
          </div>
          <p className="hw-parent-info">
            {row.linkedParent
              ? `Phụ huynh: ${row.parentName ?? 'Đã liên kết'}${row.parentEmail ? ` (${row.parentEmail})` : ''}`
              : `Chưa liên kết tài khoản PH${row.parentName ? ` · ${row.parentName}` : ''}`}
            {row.parentPhone ? ` · SĐT: ${row.parentPhone}` : ''}
          </p>
        </div>
        <div className="hw-status-badges">
          {row.pages.length > 0 ? (
            <span
              className={`plan-status-badge ${row.late ? 'upcoming' : 'active'}`}
            >
              {row.late ? 'Nộp muộn' : 'Đã nộp'} ({row.pages.length} trang)
            </span>
          ) : (
            <span className="plan-status-badge ended">Chưa nộp ảnh</span>
          )}
          {row.sentToParentAt ? (
            <span className="plan-status-badge active">
              Đã gửi PH: {formatDateTime(row.sentToParentAt)}
            </span>
          ) : row.scheduledSendAt ? (
            <span className="plan-status-badge upcoming">
              Hẹn gửi: {formatDateTime(row.scheduledSendAt)}
            </span>
          ) : graded ? (
            <span className="plan-status-badge upcoming">Đã chấm · Chờ gửi</span>
          ) : null}
        </div>
      </div>

      {row.pages.length > 0 && (
        <div className="hw-pages-strip">
          {row.pages.map((p) => (
            <button
              key={p.id}
              type="button"
              className="hw-page-thumb-btn"
              onClick={() => onZoom(p)}
              title="Bấm để phóng to ảnh bài làm"
            >
              <AuthImage
                url={p.imageUrl}
                alt={`Trang ${p.pageNumber}`}
                className="hw-page-thumb"
              />
              <span>Trang {p.pageNumber}</span>
            </button>
          ))}
        </div>
      )}

      <div className="hw-grade-grid two-cols">
        <label className="hw-field">
          <span>Điểm số (0 – 10)</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.25}
            value={score}
            disabled={busy}
            onChange={(e) => setScore(e.target.value)}
            placeholder="VD: 9.5"
          />
        </label>
        <label className="hw-field">
          <span>Xếp loại (TT27)</span>
          <select
            value={rating}
            disabled={busy}
            onChange={(e) => setRating(e.target.value as EvaluationRating | '')}
          >
            <option value="">— Chọn mức đánh giá —</option>
            <option value="HOAN_THANH_TOT">Hoàn thành tốt</option>
            <option value="HOAN_THANH">Hoàn thành</option>
            <option value="CAN_CO_GANG">Cần cố gắng</option>
          </select>
        </label>
      </div>

      <label className="hw-field">
        <span>Nhận xét của giáo viên</span>
        <textarea
          rows={2}
          maxLength={1000}
          value={comment}
          disabled={busy}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Nhập nhận xét chi tiết cho phụ huynh và bé..."
        />
      </label>

      <div className="hw-grade-actions">
        <label className="hw-checkbox-label">
          <input
            type="checkbox"
            checked={needsAttention}
            onChange={(e) => setNeedsAttention(e.target.checked)}
          />
          <span>Cần lưu ý phụ huynh</span>
        </label>
        <div className="hw-grade-btns">
          <button
            type="button"
            className="ai-button is-subtle"
            disabled={busy}
            onClick={handleSingleAiClick}
          >
            <Icon name="sparkles" size={16} />
            AI chấm nhanh
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void saveDraft()}
          >
            {busy ? 'Đang lưu...' : 'Lưu điểm'}
          </button>
        </div>
      </div>

      {aiNote && <p className="hw-ai-inline-note">{aiNote}</p>}
      {msg && (
        <p role="status" className="form-success">
          {msg}
        </p>
      )}
      {err && (
        <p role="alert" className="form-error">
          {err}
        </p>
      )}
    </article>
  )
}
