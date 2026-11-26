import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, apiError } from '../../api/client'
import type {
  BatchSummary,
  ClassroomDetail,
  ClassroomInvitation,
  ClassroomJoinRequest,
  EnrollmentDetail,
  EnrollmentRow,
} from '../../api/types'
import type { Subject } from '../../types'
import { gradeLabels, subjectLabels } from '../../data'
import { useResource } from '../../hooks/useResource'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Modal } from '../../components/Modal'
import { DeleteDialog } from '../../components/DeleteDialog'
import { Icon } from '../../components/Icons'

function todayIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateVi(iso: string) {
  const parts = iso.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
}

export function TeacherClassroomPage() {
  const { classroomId } = useParams()
  const detail = useResource<ClassroomDetail>(
    classroomId ? `/teacher/classrooms/${classroomId}` : null,
  )
  const enrollmentDetails = useResource<EnrollmentDetail[]>(
    classroomId ? `/teacher/classrooms/${classroomId}/enrollments/detail` : null,
  )
  const invitations = useResource<ClassroomInvitation[]>(
    classroomId ? `/teacher/classrooms/${classroomId}/invitations` : null,
  )
  const joinRequests = useResource<ClassroomJoinRequest[]>(
    classroomId ? `/teacher/classrooms/${classroomId}/join-requests` : null,
  )

  const [showAddStudent, setShowAddStudent] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showNewBatch, setShowNewBatch] = useState(false)
  const [showNewHomework, setShowNewHomework] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [editingEnrollment, setEditingEnrollment] =
    useState<EnrollmentDetail | null>(null)
  const [deletingEnrollment, setDeletingEnrollment] =
    useState<EnrollmentRow | null>(null)
  const [deletingBatch, setDeletingBatch] = useState<BatchSummary | null>(null)
  const [copied, setCopied] = useState(false)

  if (detail.loading) return <Loading message="Đang mở thông tin lớp..." />
  if (detail.error)
    return <ErrorPanel message={detail.error} onRetry={detail.reload} />
  if (!detail.data) return null

  const { classroom, enrollments, batches } = detail.data
  const detailById = new Map((enrollmentDetails.data ?? []).map((d) => [d.id, d]))

  async function reviewJoin(reqId: number, approve: boolean) {
    await api.post(
      `/teacher/classrooms/${classroom.id}/join-requests/${reqId}/review`,
      { approve },
    )
    joinRequests.reload()
    detail.reload()
    enrollmentDetails.reload()
  }

  function copyJoinCode() {
    void navigator.clipboard?.writeText(classroom.joinCode)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="page-enter">
      <Link to="/giao-vien" className="back-link">
        ← Về danh sách lớp
      </Link>

      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {gradeLabels[classroom.gradeLevel]} · NĂM HỌC {classroom.schoolYear}
          </span>
          <h1>{classroom.name}</h1>
          <p>
            Gửi mã lớp cho phụ huynh nhập tại trang <strong>Hồ sơ các bé</strong>{' '}
            để nhận báo cáo trực tiếp trên web.
          </p>
        </div>
        <div className="teacher-roster-btns">
          <Link
            to={`/giao-vien/lop/${classroom.id}/bang-diem`}
            className="soft-button"
          >
            Bảng điểm cả lớp
            <Icon name="chart" size={17} />
          </Link>
          <button
            type="button"
            className="join-code-pill large"
            onClick={copyJoinCode}
          >
            <span>Mã mời lớp:</span>
            <strong>{classroom.joinCode}</strong>
            <small>{copied ? 'Đã sao chép!' : 'Sao chép'}</small>
          </button>
        </div>
      </header>

      <section className="panel teacher-section">
        <div className="section-heading">
          <div>
            <h2>Đợt chấm & Bài tập về nhà ({batches.length})</h2>
            <p>
              Cô có thể giao bài tập Toán/Tiếng Việt (phụ huynh chụp ảnh nộp)
              hoặc chấm bài trực tiếp tại lớp.
            </p>
          </div>
          <div className="teacher-roster-btns">
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowNewHomework(true)}
            >
              Giao bài tập về nhà
              <Icon name="pen" size={17} />
            </button>
            <button
              type="button"
              className="soft-button"
              onClick={() => setShowNewBatch(true)}
            >
              Chấm bài tại lớp
              <Icon name="calendar" size={17} />
            </button>
          </div>
        </div>

        {batches.length === 0 ? (
          <p className="empty-inline-note">
            Chưa có bài tập hay đợt chấm nào. Bấm “Giao bài tập về nhà” hoặc
            “Chấm bài tại lớp” để bắt đầu nhé.
          </p>
        ) : (
          <div className="teacher-batch-list">
            {batches.map((b) => (
              <article key={b.id} className="teacher-batch-row">
                <div>
                  <strong>{b.title}</strong>
                  <p>
                    Ngày {formatDateVi(b.batchDate)}
                    {b.notes ? ` · ${b.notes}` : ''}
                  </p>
                  <div className="teacher-batch-pills">
                    <span>
                      Đã chấm: {b.evaluatedCount}/{b.totalStudents}
                    </span>
                    {b.attentionCount > 0 && (
                      <span className="is-warn">
                        Cần chú ý: {b.attentionCount}
                      </span>
                    )}
                    <span className="is-ok">Đã gửi PH: {b.sentCount}</span>
                  </div>
                </div>
                <div className="teacher-batch-actions">
                  <Link
                    to={`/giao-vien/bai-tap/${b.id}`}
                    className="primary-button"
                  >
                    Chấm bài
                    <Icon name="arrow" size={16} />
                  </Link>
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={() => setDeletingBatch(b)}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {(joinRequests.data?.length ?? 0) > 0 && (
        <section className="panel teacher-section">
          <h2>Yêu cầu tham gia lớp chờ duyệt ({joinRequests.data!.length})</h2>
          <div className="invitation-list">
            {joinRequests.data!.map((r) => (
              <div key={r.id} className="invitation-row">
                <div>
                  <strong>Bé {r.studentNickname}</strong>
                  <p>
                    Phụ huynh: {r.parentName} ({r.parentEmail})
                    {r.message ? ` · "${r.message}"` : ''}
                  </p>
                </div>
                <div className="teacher-roster-btns">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void reviewJoin(r.id, true)}
                  >
                    Duyệt vào lớp
                  </button>
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => void reviewJoin(r.id, false)}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel teacher-section">
        <div className="section-heading">
          <div>
            <h2>Danh sách học sinh & Phụ huynh ({enrollments.length})</h2>
            <p>
              Xem thông tin học sinh và phụ huynh tương ứng trong lớp, mời phụ
              huynh bằng email hoặc mã lớp.
            </p>
          </div>
          <div className="teacher-roster-btns">
            <button
              type="button"
              className="soft-button"
              onClick={() => setShowInvite(true)}
            >
              Mời phụ huynh
            </button>
            <button
              type="button"
              className="soft-button"
              onClick={() => setShowImport(true)}
            >
              Nhập nhiều em (CSV / danh sách)
              <Icon name="upload" size={16} />
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowAddStudent(true)}
            >
              Thêm 1 học sinh
            </button>
          </div>
        </div>

        {enrollments.length === 0 ? (
          <p className="empty-inline-note">
            Lớp chưa có học sinh nào. Cô thêm học sinh hoặc gửi mã{' '}
            <strong>{classroom.joinCode}</strong> cho phụ huynh nhé.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="teacher-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Học sinh</th>
                  <th>Năm sinh</th>
                  <th>Liên kết phụ huynh</th>
                  <th>Bài luyện online</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e, idx) => {
                  const extra = detailById.get(e.id)
                  return (
                    <tr key={e.id}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{e.displayName}</strong>
                        {extra?.teacherNote && (
                          <div className="gradebook-sub">{extra.teacherNote}</div>
                        )}
                      </td>
                      <td>{e.birthYear ?? '—'}</td>
                      <td>
                        {e.linkedParent ? (
                          <div>
                            <span className="plan-status-badge active">
                              {e.parentName || 'Đã liên kết'}
                            </span>
                            {extra?.linkedParentEmail && (
                              <div className="gradebook-sub">
                                {extra.linkedParentEmail}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="plan-status-badge ended">
                            {extra?.parentNameNote || 'Chưa liên kết'}
                          </span>
                        )}
                        {extra?.parentPhone && (
                          <div className="gradebook-sub">
                            SĐT: {extra.parentPhone}
                          </div>
                        )}
                      </td>
                      <td>{e.linkedParent ? `${e.submissionCount} bài` : '—'}</td>
                      <td>
                        <div className="admin-user-actions">
                          {extra && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setEditingEnrollment(extra)}
                            >
                              Sửa
                            </button>
                          )}
                          <button
                            type="button"
                            className="text-button danger-text"
                            onClick={() => setDeletingEnrollment(e)}
                          >
                            Gỡ khỏi lớp
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showAddStudent && (
        <AddStudentModal
          classroomId={classroom.id}
          onClose={() => setShowAddStudent(false)}
          onSaved={() => {
            setShowAddStudent(false)
            detail.reload()
          }}
        />
      )}

      {showImport && (
        <ImportStudentsModal
          classroomId={classroom.id}
          onClose={() => setShowImport(false)}
          onSaved={() => {
            setShowImport(false)
            detail.reload()
          }}
        />
      )}

      {showNewBatch && (
        <NewBatchModal
          classroomId={classroom.id}
          onClose={() => setShowNewBatch(false)}
          onSaved={() => {
            setShowNewBatch(false)
            detail.reload()
          }}
        />
      )}

      {showNewHomework && (
        <NewHomeworkModal
          classroomId={classroom.id}
          onClose={() => setShowNewHomework(false)}
          onSaved={() => {
            setShowNewHomework(false)
            detail.reload()
          }}
        />
      )}

      {showInvite && (
        <InviteParentModal
          classroomId={classroom.id}
          invitations={invitations.data ?? []}
          onClose={() => setShowInvite(false)}
          onChanged={invitations.reload}
        />
      )}

      {editingEnrollment && (
        <EditEnrollmentModal
          classroomId={classroom.id}
          initial={editingEnrollment}
          onClose={() => setEditingEnrollment(null)}
          onSaved={() => {
            setEditingEnrollment(null)
            detail.reload()
            enrollmentDetails.reload()
          }}
        />
      )}

      {deletingEnrollment && (
        <DeleteDialog
          title={`Gỡ ${deletingEnrollment.displayName} khỏi lớp?`}
          description="Học sinh và các dòng nhận xét của em trong lớp này sẽ bị gỡ. Tài khoản phụ huynh không bị ảnh hưởng."
          url={`/teacher/classrooms/${classroom.id}/enrollments/${deletingEnrollment.id}`}
          onClose={() => setDeletingEnrollment(null)}
          onDeleted={() => {
            setDeletingEnrollment(null)
            detail.reload()
          }}
        />
      )}

      {deletingBatch && (
        <DeleteDialog
          title={`Xóa đợt chấm "${deletingBatch.title}"?`}
          description="Toàn bộ đánh giá trong đợt chấm này sẽ bị xóa vĩnh viễn."
          url={`/teacher/classrooms/${classroom.id}/batches/${deletingBatch.id}`}
          onClose={() => setDeletingBatch(null)}
          onDeleted={() => {
            setDeletingBatch(null)
            detail.reload()
          }}
        />
      )}
    </div>
  )
}

function AddStudentModal({
  classroomId,
  onClose,
  onSaved,
}: {
  classroomId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState('')
  const [birthYear, setBirthYear] = useState(
    String(new Date().getFullYear() - 6),
  )
  const [parentEmail, setParentEmail] = useState('')
  const [parentNameNote, setParentNameNote] = useState('')
  const [parentPhone, setParentPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !displayName.trim() || !parentEmail.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/teacher/classrooms/${classroomId}/enrollments`, {
        displayName: displayName.trim(),
        birthYear: birthYear ? Number(birthYear) : null,
        parentEmail: parentEmail.trim(),
        parentNameNote: parentNameNote.trim() || null,
        parentPhone: parentPhone.trim() || null,
      })
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Thêm học sinh & liên kết phụ huynh" busy={busy} onClose={onClose}>
      <p className="dialog-intro">
        Mỗi học sinh thêm vào lớp cần gắn với <strong>email tài khoản phụ huynh</strong> để gửi bài tập về nhà, điểm số và nhận xét trực tiếp.
      </p>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Họ tên / Biệt danh học sinh
          <input
            required
            maxLength={80}
            value={displayName}
            disabled={busy}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Ví dụ: Nguyễn Minh An (Bé Na)"
          />
        </label>
        <label>
          Email tài khoản phụ huynh (bắt buộc)
          <input
            type="email"
            required
            maxLength={255}
            value={parentEmail}
            disabled={busy}
            onChange={(e) => setParentEmail(e.target.value)}
            placeholder="phuhuynh@example.com"
          />
        </label>
        <div className="form-row-two">
          <label>
            Năm sinh (tùy chọn)
            <input
              type="number"
              min={2008}
              max={new Date().getFullYear()}
              value={birthYear}
              disabled={busy}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </label>
          <label>
            SĐT phụ huynh (tùy chọn)
            <input
              maxLength={25}
              value={parentPhone}
              disabled={busy}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="09xx xxx xxx"
            />
          </label>
        </div>
        <label>
          Tên phụ huynh hiển thị trong lớp (tùy chọn)
          <input
            maxLength={100}
            value={parentNameNote}
            disabled={busy}
            onChange={(e) => setParentNameNote(e.target.value)}
            placeholder="Để trống sẽ tự lấy theo tài khoản phụ huynh"
          />
        </label>
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
            {busy ? 'Đang thêm...' : 'Thêm vào lớp'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ImportStudentsModal({
  classroomId,
  onClose,
  onSaved,
}: {
  classroomId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [rawText, setRawText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function parseRows(text: string) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim())
        const name = parts[0] ?? ''
        const yearNum = parts[1] ? Number(parts[1]) : NaN
        const birthYear =
          Number.isInteger(yearNum) &&
          yearNum >= 2008 &&
          yearNum <= new Date().getFullYear()
            ? yearNum
            : null
        const parentEmail = parts[2] ?? ''
        const parentPhone = parts[3] || null
        return { displayName: name, birthYear, parentEmail, parentPhone }
      })
      .filter(
        (r) =>
          r.displayName &&
          !['họ tên', 'ho ten', 'tên học sinh', 'name'].includes(
            r.displayName.toLowerCase(),
          ),
      )
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    setRawText(text)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const students = parseRows(rawText)
    if (students.length === 0) {
      setError('Chưa có dòng học sinh hợp lệ nào.')
      return
    }
    const missingParent = students.find((s) => !s.parentEmail.includes('@'))
    if (missingParent) {
      setError(
        `Học sinh "${missingParent.displayName}" chưa có email phụ huynh hợp lệ (định dạng: Tên học sinh, Năm sinh, Email phụ huynh).`,
      )
      return
    }
    if (students.length > 100) {
      setError('Mỗi lần nhập tối đa 100 học sinh.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post(`/teacher/classrooms/${classroomId}/enrollments/import`, {
        students,
      })
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  const previewCount = parseRows(rawText).length

  return (
    <Modal title="Nhập nhanh danh sách học sinh" busy={busy} onClose={onClose}>
      <p className="dialog-intro">
        Chọn file <strong>.csv</strong> (xuất từ Excel) hoặc dán danh sách mỗi
        học sinh một dòng dạng{' '}
        <code>Tên học sinh, Năm sinh, Email phụ huynh, SĐT (tùy chọn)</code>.
      </p>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Chọn file CSV (tùy chọn)
          <input
            type="file"
            accept=".csv,.txt"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </label>
        <label>
          Danh sách học sinh ({previewCount} em)
          <textarea
            rows={7}
            value={rawText}
            disabled={busy}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              'Bé Na, 2020, me.na@netxinh.local, 0901112233\nBé Bi, 2020, bo.bi@netxinh.local'
            }
          />
        </label>
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
          <button
            type="submit"
            className="primary-button"
            disabled={busy || previewCount === 0}
          >
            {busy ? 'Đang nhập...' : `Nhập ${previewCount} học sinh`}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function NewBatchModal({
  classroomId,
  onClose,
  onSaved,
}: {
  classroomId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [batchDate, setBatchDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !title.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/teacher/classrooms/${classroomId}/batches`, {
        title: title.trim(),
        batchDate,
        notes: notes.trim() || null,
      })
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Chấm bài tại lớp" busy={busy} onClose={onClose}>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Tên đợt chấm
          <input
            required
            maxLength={150}
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Tuần 12 – Vở sạch chữ đẹp"
          />
        </label>
        <label>
          Ngày chấm
          <input
            type="date"
            required
            value={batchDate}
            disabled={busy}
            onChange={(e) => setBatchDate(e.target.value)}
          />
        </label>
        <label>
          Ghi chú đợt chấm (tùy chọn)
          <textarea
            rows={2}
            maxLength={500}
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ví dụ: Tập viết chữ ghép ch, nh, th trên vở 4 ô ly"
          />
        </label>
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
            {busy ? 'Đang tạo...' : 'Tạo đợt chấm'}
          </button>
        </div>
      </form>
    </Modal>
  )
}


function NewHomeworkModal({
  classroomId,
  onClose,
  onSaved,
}: {
  classroomId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [title, setTitle] = useState('')
  const [subject, setSubject] = useState<Subject>('TIENG_VIET')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [requiredPages, setRequiredPages] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !title.trim() || !description.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.post(`/teacher/classrooms/${classroomId}/homework`, {
        title: title.trim(),
        subject,
        description: description.trim(),
        dueAt: dueAt ? `${dueAt}:00` : null,
        requiredPages,
        notes: null,
      })
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Giao bài tập về nhà" busy={busy} onClose={onClose}>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          <label>
            Môn học
            <select
              value={subject}
              disabled={busy}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              <option value="TIENG_VIET">{subjectLabels.TIENG_VIET}</option>
              <option value="TOAN">{subjectLabels.TOAN}</option>
            </select>
          </label>
          <label>
            Số trang ảnh yêu cầu (1–10)
            <input
              type="number"
              min={1}
              max={10}
              value={requiredPages}
              disabled={busy}
              onChange={(e) => setRequiredPages(Number(e.target.value) || 1)}
            />
          </label>
        </div>
        <label>
          Tiêu đề bài tập
          <input
            required
            maxLength={150}
            value={title}
            disabled={busy}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Tập chép bài thơ / Đặt tính cộng trừ tuần 5"
          />
        </label>
        <label>
          Nội dung đề bài & yêu cầu chụp vở
          <textarea
            required
            rows={4}
            maxLength={4000}
            value={description}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ghi rõ nội dung bài tập và các trang vở phụ huynh cần chụp gửi lại..."
          />
        </label>
        <label>
          Thời hạn nộp (tùy chọn)
          <input
            type="datetime-local"
            value={dueAt}
            disabled={busy}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>
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
            {busy ? 'Đang giao...' : 'Giao bài & báo phụ huynh'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function InviteParentModal({
  classroomId,
  invitations,
  onClose,
  onChanged,
}: {
  classroomId: number
  invitations: ClassroomInvitation[]
  onClose: () => void
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true)
    setMsg('')
    setErr('')
    try {
      await api.post(`/teacher/classrooms/${classroomId}/invitations`, {
        parentEmail: email.trim(),
      })
      setEmail('')
      setMsg('Đã gửi lời mời tới phụ huynh!')
      onChanged()
    } catch (failure) {
      setErr(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Mời phụ huynh vào lớp" busy={busy} onClose={onClose}>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Email tài khoản phụ huynh
          <input
            type="email"
            required
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="phuhuynh@example.com"
          />
        </label>
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
        <div className="dialog-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang gửi...' : 'Gửi lời mời'}
          </button>
        </div>
      </form>
      {invitations.length > 0 && (
        <div className="my-join-requests">
          <h3>Lời mời gần đây</h3>
          <ul>
            {invitations.slice(0, 8).map((inv) => (
              <li key={inv.id}>
                <strong>{inv.parentEmail}</strong> — {inv.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function EditEnrollmentModal({
  classroomId,
  initial,
  onClose,
  onSaved,
}: {
  classroomId: number
  initial: EnrollmentDetail
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [birthYear, setBirthYear] = useState(
    initial.birthYear == null ? '' : String(initial.birthYear),
  )
  const [parentNameNote, setParentNameNote] = useState(
    initial.parentNameNote ?? '',
  )
  const [parentPhone, setParentPhone] = useState(initial.parentPhone ?? '')
  const [teacherNote, setTeacherNote] = useState(initial.teacherNote ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !displayName.trim()) return
    setBusy(true)
    setErr('')
    try {
      await api.put(`/teacher/classrooms/${classroomId}/enrollments/${initial.id}`, {
        displayName: displayName.trim(),
        birthYear: birthYear.trim() ? Number(birthYear) : null,
        parentNameNote: parentNameNote.trim() || null,
        parentPhone: parentPhone.trim() || null,
        teacherNote: teacherNote.trim() || null,
      })
      onSaved()
    } catch (failure) {
      setErr(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Sửa thông tin học sinh & phụ huynh trong lớp" busy={busy} onClose={onClose}>
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <div className="form-grid">
          <label>
            Tên hiển thị của học sinh
            <input
              required
              maxLength={80}
              value={displayName}
              disabled={busy}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label>
            Năm sinh
            <input
              type="number"
              min={2008}
              max={2026}
              value={birthYear}
              disabled={busy}
              onChange={(e) => setBirthYear(e.target.value)}
            />
          </label>
        </div>
        <div className="form-grid">
          <label>
            Tên phụ huynh (ghi chú lớp)
            <input
              maxLength={100}
              value={parentNameNote}
              disabled={busy}
              onChange={(e) => setParentNameNote(e.target.value)}
              placeholder={initial.linkedParentName ?? 'Chị Hoa / Anh Minh...'}
            />
          </label>
          <label>
            Số điện thoại phụ huynh
            <input
              maxLength={30}
              value={parentPhone}
              disabled={busy}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="09xx..."
            />
          </label>
        </div>
        <label>
          Ghi chú của giáo viên
          <input
            maxLength={300}
            value={teacherNote}
            disabled={busy}
            onChange={(e) => setTeacherNote(e.target.value)}
          />
        </label>
        {err && (
          <p role="alert" className="form-error">
            {err}
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
            {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
