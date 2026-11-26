import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../../api/client'
import type { ClassroomSummary } from '../../api/types'
import type { Grade } from '../../types'
import { gradeLabels, gradeOptions } from '../../data'
import { useResource } from '../../hooks/useResource'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { DeleteDialog } from '../../components/DeleteDialog'
import { Mascot } from '../../components/Artwork'
import { Icon } from '../../components/Icons'

function ClassroomModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ClassroomSummary | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [schoolYear, setSchoolYear] = useState(
    initial?.schoolYear ?? '2026-2027',
  )
  const [gradeLevel, setGradeLevel] = useState<Grade>(
    initial?.gradeLevel ?? 'LOP_1',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !name.trim() || !schoolYear.trim()) return
    setBusy(true)
    setError('')
    const body = {
      name: name.trim(),
      schoolYear: schoolYear.trim(),
      gradeLevel,
    }
    try {
      if (initial) await api.put(`/teacher/classrooms/${initial.id}`, body)
      else await api.post('/teacher/classrooms', body)
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Chỉnh sửa lớp học' : 'Tạo lớp học mới'}
      busy={busy}
      onClose={onClose}
    >
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Tên lớp
          <input
            required
            maxLength={100}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ví dụ: Lớp 1A, Lớp Lá 2..."
          />
        </label>
        <div className="form-grid">
          <label>
            Năm học
            <input
              required
              maxLength={30}
              value={schoolYear}
              disabled={busy}
              onChange={(e) => setSchoolYear(e.target.value)}
              placeholder="2026-2027"
            />
          </label>
          <label>
            Cấp học
            <select
              value={gradeLevel}
              disabled={busy}
              onChange={(e) => setGradeLevel(e.target.value as Grade)}
            >
              {gradeOptions.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>
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
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Tạo lớp'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function TeacherClassesPage() {
  const classes = useResource<ClassroomSummary[]>('/teacher/classrooms')
  const [editing, setEditing] = useState<ClassroomSummary | 'new' | null>(null)
  const [deleting, setDeleting] = useState<ClassroomSummary | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  function copyCode(c: ClassroomSummary) {
    void navigator.clipboard?.writeText(c.joinCode)
    setCopiedId(c.id)
    window.setTimeout(() => setCopiedId((id) => (id === c.id ? null : id)), 2000)
  }

  return (
    <div className="page-enter">
      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">GIÁO VIÊN CHỦ NHIỆM</span>
          <h1>Lớp học của cô</h1>
          <p>
            Quản lý danh sách học sinh, chấm vở theo đợt, xuất bảng Excel và gửi
            báo cáo cho phụ huynh.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setEditing('new')}
        >
          Tạo lớp học mới
          <Icon name="user" size={18} />
        </button>
      </header>

      {classes.loading ? (
        <Loading message="Đang tải danh sách lớp..." />
      ) : classes.error ? (
        <ErrorPanel message={classes.error} onRetry={classes.reload} />
      ) : !classes.data?.length ? (
        <div className="empty-state panel">
          <Mascot waving />
          <h2>Cô chưa tạo lớp học nào</h2>
          <p>
            Tạo lớp học đầu tiên để nhận mã mời gửi phụ huynh, nhập danh sách
            học sinh và mở bảng chấm vở cả lớp.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setEditing('new')}
          >
            Tạo lớp đầu tiên
            <Icon name="arrow" size={18} />
          </button>
        </div>
      ) : (
        <div className="teacher-class-grid">
          {classes.data.map((c) => (
            <article key={c.id} className="panel teacher-class-card">
              <div className="teacher-class-head">
                <div>
                  <span className="eyebrow">
                    {gradeLabels[c.gradeLevel]} · {c.schoolYear}
                  </span>
                  <h2>{c.name}</h2>
                </div>
                <button
                  type="button"
                  className="join-code-pill"
                  title="Sao chép mã mời phụ huynh"
                  onClick={() => copyCode(c)}
                >
                  <span>Mã lớp:</span>
                  <strong>{c.joinCode}</strong>
                  <small>{copiedId === c.id ? 'Đã chép!' : 'Chép'}</small>
                </button>
              </div>

              <div className="teacher-class-stats">
                <span>
                  <strong>{c.studentCount}</strong> học sinh
                </span>
                <span>
                  <strong>{c.batchCount}</strong> đợt chấm
                </span>
              </div>

              <div className="teacher-class-actions">
                <Link
                  to={`/giao-vien/lop/${c.id}`}
                  className="primary-button"
                >
                  Mở lớp & chấm vở
                  <Icon name="arrow" size={16} />
                </Link>
                <button
                  type="button"
                  className="soft-button"
                  onClick={() => setEditing(c)}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => setDeleting(c)}
                >
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <ClassroomModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            classes.reload()
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          title={`Xóa lớp ${deleting.name}?`}
          description={`Xóa vĩnh viễn lớp ${deleting.name} cùng toàn bộ đợt chấm và nhận xét của lớp? Hồ sơ bé và lịch sử luyện viết cá nhân của phụ huynh vẫn được giữ nguyên.`}
          url={`/teacher/classrooms/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            classes.reload()
          }}
        />
      )}
    </div>
  )
}
