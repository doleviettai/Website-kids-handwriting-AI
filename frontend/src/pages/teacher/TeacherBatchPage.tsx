import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiError } from '../../api/client'
import type {
  BatchSheet,
  EvaluationRating,
  EvaluationRow,
  SendReportsResponse,
} from '../../api/types'
import { useResource } from '../../hooks/useResource'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Icon } from '../../components/Icons'

const RATINGS: { value: EvaluationRating; label: string }[] = [
  { value: 'HOAN_THANH_TOT', label: 'Hoàn thành tốt' },
  { value: 'HOAN_THANH', label: 'Hoàn thành' },
  { value: 'CAN_CO_GANG', label: 'Cần cố gắng' },
]

type RowDraft = {
  rating: EvaluationRating | ''
  teacherComment: string
  needsAttention: boolean
  dirty: boolean
  saving: boolean
}

export function TeacherBatchPage() {
  const { batchId } = useParams()
  const sheet = useResource<BatchSheet>(
    batchId ? `/teacher/batches/${batchId}/evaluations` : null,
  )

  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({})
  const [filter, setFilter] = useState<'ALL' | 'ATTENTION' | 'PENDING'>('ALL')
  const [query, setQuery] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [actionError, setActionError] = useState('')
  const [sendingAll, setSendingAll] = useState(false)
  const [exporting, setExporting] = useState(false)

  function getDraft(row: EvaluationRow): RowDraft {
    return (
      drafts[row.enrollmentId] ?? {
        rating: row.rating ?? '',
        teacherComment: row.teacherComment ?? '',
        needsAttention: row.needsAttention,
        dirty: false,
        saving: false,
      }
    )
  }

  function patchDraft(row: EvaluationRow, patch: Partial<RowDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [row.enrollmentId]: { ...getDraft(row), ...patch, dirty: true },
    }))
  }

  async function saveRow(row: EvaluationRow) {
    if (!batchId) return
    const draft = getDraft(row)
    setDrafts((prev) => ({
      ...prev,
      [row.enrollmentId]: { ...draft, saving: true },
    }))
    setActionError('')
    setStatusMsg('')
    try {
      const res = await api.put<EvaluationRow>(
        `/teacher/batches/${batchId}/evaluations/${row.enrollmentId}`,
        {
          rating: draft.rating || null,
          teacherComment: draft.teacherComment.trim() || null,
          needsAttention: draft.needsAttention,
        },
      )
      setDrafts((prev) => ({
        ...prev,
        [row.enrollmentId]: {
          rating: res.data.rating ?? '',
          teacherComment: res.data.teacherComment ?? '',
          needsAttention: res.data.needsAttention,
          dirty: false,
          saving: false,
        },
      }))
      setStatusMsg(`Đã lưu nhận xét cho ${row.displayName}.`)
      sheet.reload()
    } catch (failure) {
      setDrafts((prev) => ({
        ...prev,
        [row.enrollmentId]: { ...draft, saving: false },
      }))
      setActionError(apiError(failure))
    }
  }

  async function sendReport(enrollmentId?: number) {
    if (!batchId) return
    if (enrollmentId == null) setSendingAll(true)
    setActionError('')
    setStatusMsg('')
    try {
      const res = await api.post<SendReportsResponse>(
        `/teacher/batches/${batchId}/send-reports`,
        enrollmentId == null ? {} : { enrollmentId },
      )
      const { sentCount, skippedUnlinked, skippedEmpty } = res.data
      const parts = [`Đã gửi báo cáo cho ${sentCount} phụ huynh.`]
      if (skippedUnlinked > 0)
        parts.push(`${skippedUnlinked} em chưa liên kết tài khoản phụ huynh.`)
      if (skippedEmpty > 0) parts.push(`${skippedEmpty} em chưa có nội dung chấm.`)
      setStatusMsg(parts.join(' '))
      sheet.reload()
    } catch (failure) {
      setActionError(apiError(failure))
    } finally {
      setSendingAll(false)
    }
  }

  async function downloadExcelCsv() {
    if (!batchId || exporting) return
    setExporting(true)
    setActionError('')
    try {
      const res = await api.get<Blob>(`/teacher/batches/${batchId}/export.csv`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `bao-cao-lop-${batchId}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (failure) {
      setActionError(apiError(failure))
    } finally {
      setExporting(false)
    }
  }

  const visibleRows = useMemo(() => {
    const rows = sheet.data?.rows ?? []
    const q = query.trim().toLocaleLowerCase('vi')
    return rows.filter((row) => {
      const d = drafts[row.enrollmentId]
      const attn = d ? d.needsAttention : row.needsAttention
      const rating = d ? d.rating : (row.rating ?? '')
      const comment = d ? d.teacherComment : (row.teacherComment ?? '')
      if (filter === 'ATTENTION' && !attn) return false
      if (filter === 'PENDING' && (rating || comment.trim())) return false
      if (q && !row.displayName.toLocaleLowerCase('vi').includes(q)) return false
      return true
    })
  }, [sheet.data, drafts, filter, query])

  if (sheet.loading) return <Loading message="Đang mở bảng chấm cả lớp..." />
  if (sheet.error)
    return <ErrorPanel message={sheet.error} onRetry={sheet.reload} />
  if (!sheet.data) return null

  return (
    <div className="page-enter">
      <Link to={`/giao-vien/lop/${sheet.data.classroomId}`} className="back-link no-print">
        ← Về lớp {sheet.data.classroomName}
      </Link>

      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {sheet.data.classroomName} · {sheet.data.schoolYear} · NGÀY{' '}
            {sheet.data.batchDate}
          </span>
          <h1>{sheet.data.title}</h1>
          {sheet.data.notes && <p>{sheet.data.notes}</p>}
        </div>
        <div className="teacher-batch-top-actions no-print">
          <button
            type="button"
            className="soft-button"
            disabled={exporting}
            onClick={() => void downloadExcelCsv()}
          >
            <Icon name="download" size={17} />
            {exporting ? 'Đang xuất...' : 'Xuất Excel (.csv)'}
          </button>
          <button
            type="button"
            className="soft-button"
            onClick={() => window.print()}
          >
            In phiếu họp PH
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={sendingAll}
            onClick={() => void sendReport()}
          >
            {sendingAll ? 'Đang gửi...' : 'Gửi báo cáo cả lớp'}
            <Icon name="bell" size={17} />
          </button>
        </div>
      </header>

      <div className="panel teacher-ai-notice no-print">
        <Icon name="camera" size={20} />
        <span>
          <strong>Sẵn sàng nối AI chụp vở V5+Kids:</strong> bảng chấm đã chuẩn
          bị sẵn cột ảnh vở & chỉ số trình bày — sau khi train xong model sẽ tự
          động điền gợi ý nhận xét cho từng em.
        </span>
      </div>

      <div className="teacher-sheet-toolbar no-print">
        <div className="notification-filter-tabs">
          <button
            type="button"
            className={filter === 'ALL' ? 'primary-button' : 'soft-button'}
            onClick={() => setFilter('ALL')}
          >
            Tất cả ({sheet.data.rows.length})
          </button>
          <button
            type="button"
            className={
              filter === 'ATTENTION' ? 'primary-button' : 'soft-button'
            }
            onClick={() => setFilter('ATTENTION')}
          >
            Cần chú ý
          </button>
          <button
            type="button"
            className={filter === 'PENDING' ? 'primary-button' : 'soft-button'}
            onClick={() => setFilter('PENDING')}
          >
            Chưa chấm
          </button>
        </div>
        <input
          type="search"
          className="teacher-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tên học sinh..."
        />
      </div>

      {statusMsg && (
        <p role="status" className="form-success no-print">
          {statusMsg}
        </p>
      )}
      {actionError && (
        <p role="alert" className="form-error no-print">
          {actionError}
        </p>
      )}

      <section className="panel teacher-sheet-panel">
        <div className="table-scroll">
          <table className="teacher-table batch-sheet-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Học sinh</th>
                <th>Xếp loại (TT27)</th>
                <th>Cần chú ý</th>
                <th>Nhận xét của giáo viên</th>
                <th className="no-print">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => {
                const draft = getDraft(row)
                return (
                  <tr
                    key={row.enrollmentId}
                    className={draft.needsAttention ? 'row-attention' : ''}
                  >
                    <td>{idx + 1}</td>
                    <td>
                      <strong>{row.displayName}</strong>
                      <div className="student-submeta">
                        {row.linkedParent ? (
                          <span className="linked-tag">
                            PH: {row.parentName || 'Đã liên kết'}
                          </span>
                        ) : (
                          <span className="unlinked-tag">Chưa liên kết PH</span>
                        )}
                        {row.sentToParentAt && (
                          <span className="sent-tag">Đã gửi ✓</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        aria-label={`Xếp loại cho ${row.displayName}`}
                        value={draft.rating}
                        disabled={draft.saving}
                        onChange={(e) =>
                          patchDraft(row, {
                            rating: e.target.value as EvaluationRating | '',
                          })
                        }
                      >
                        <option value="">— Chưa xếp loại —</option>
                        {RATINGS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="center-cell">
                      <input
                        type="checkbox"
                        aria-label={`Đánh dấu cần chú ý cho ${row.displayName}`}
                        checked={draft.needsAttention}
                        disabled={draft.saving}
                        onChange={(e) =>
                          patchDraft(row, { needsAttention: e.target.checked })
                        }
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        maxLength={1000}
                        aria-label={`Nhận xét cho ${row.displayName}`}
                        value={draft.teacherComment}
                        disabled={draft.saving}
                        onChange={(e) =>
                          patchDraft(row, { teacherComment: e.target.value })
                        }
                        placeholder="Nhập nhận xét trình bày / nét chữ cho bé..."
                      />
                    </td>
                    <td className="no-print">
                      <div className="sheet-row-actions">
                        <button
                          type="button"
                          className={
                            draft.dirty ? 'primary-button' : 'soft-button'
                          }
                          disabled={draft.saving}
                          onClick={() => void saveRow(row)}
                        >
                          {draft.saving ? 'Lưu...' : 'Lưu'}
                        </button>
                        {row.linkedParent && (
                          <button
                            type="button"
                            className="text-button"
                            disabled={draft.saving || draft.dirty}
                            title={
                              draft.dirty
                                ? 'Lưu trước khi gửi phụ huynh'
                                : 'Gửi báo cáo cho phụ huynh bé này'
                            }
                            onClick={() => void sendReport(row.enrollmentId)}
                          >
                            Gửi PH
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
