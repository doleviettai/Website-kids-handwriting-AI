import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../api/client'
import type {
  ClassroomInvitation,
  ClassroomJoinRequest,
  HomeworkPage,
  ParentHomeworkItem,
  PublicClassroom,
  StudentClassroom,
} from '../api/types'
import type { Grade, Subject } from '../types'
import { gradeLabels, gradeOptions, subjectLabels } from '../data'
import { useWorkspace } from '../context/workspace-context'
import { useResource } from '../hooks/useResource'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { AuthImage } from '../components/AuthImage'
import { Mascot } from '../components/Artwork'
import { Icon } from '../components/Icons'

const ratingLabels: Record<string, string> = {
  HOAN_THANH_TOT: 'Hoàn thành tốt',
  HOAN_THANH: 'Hoàn thành',
  CAN_CO_GANG: 'Cần cố gắng',
}

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

export function ParentClassroomPage() {
  const { students, selected } = useWorkspace()
  const [subject, setSubject] = useState<Subject | 'ALL'>('ALL')
  const [searchQ, setSearchQ] = useState('')
  const [searchGrade, setSearchGrade] = useState<Grade | 'ALL'>('ALL')
  const [appliedQ, setAppliedQ] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [zoomPage, setZoomPage] = useState<HomeworkPage | null>(null)
  const [zoomLocal, setZoomLocal] = useState<{ title: string; url: string } | null>(null)
  const [requestingClass, setRequestingClass] =
    useState<PublicClassroom | null>(null)
  const [requestMsg, setRequestMsg] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestModalErr, setRequestModalErr] = useState('')
  const [requestModalSuccess, setRequestModalSuccess] = useState('')

  const myClasses = useResource<StudentClassroom[]>(
    selected ? `/students/${selected.id}/classrooms` : null,
    String(selected?.id ?? ''),
  )
  const invitations = useResource<ClassroomInvitation[]>('/parent/invitations')
  const myRequests = useResource<ClassroomJoinRequest[]>(
    '/parent/join-requests',
  )
  const searchParams = new URLSearchParams()
  if (appliedQ) searchParams.set('q', appliedQ)
  if (searchGrade !== 'ALL') searchParams.set('grade', searchGrade)
  const searchResults = useResource<PublicClassroom[]>(
    `/parent/classrooms/search?${searchParams.toString()}`,
    `${appliedQ}:${searchGrade}`,
  )
  const hwQuery = subject === 'ALL' ? '' : `?subject=${subject}`
  const homework = useResource<ParentHomeworkItem[]>(
    selected ? `/parent/students/${selected.id}/homework${hwQuery}` : null,
    `${selected?.id ?? ''}:${subject}`,
  )

  if (students.loading) return <Loading message="Đang tải lớp học của bé..." />
  if (!selected) {
    return (
      <div className="empty-state panel">
        <Mascot />
        <h2>Ba mẹ tạo hồ sơ bé trước nhé</h2>
        <p>Sau khi có hồ sơ bé, ba mẹ có thể tìm lớp và nộp bài tập cho con.</p>
        <Link to="/ho-so" className="primary-button">
          Tạo hồ sơ bé
          <Icon name="arrow" size={17} />
        </Link>
      </div>
    )
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault()
    if (!selected || !joinCode.trim() || joinBusy) return
    setJoinBusy(true)
    setFeedback('')
    setError('')
    try {
      const res = await api.post<StudentClassroom>(
        `/students/${selected.id}/join-classroom`,
        { joinCode: joinCode.trim() },
      )
      setJoinCode('')
      setFeedback(`Bé ${selected.nickname} đã vào lớp ${res.data.classroomName}!`)
      myClasses.reload()
      homework.reload()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setJoinBusy(false)
    }
  }

  async function respondInvitation(inv: ClassroomInvitation, accept: boolean) {
    if (!selected) return
    setFeedback('')
    setError('')
    try {
      await api.post(`/parent/invitations/${inv.id}/respond`, {
        accept,
        studentId: accept ? selected.id : null,
      })
      setFeedback(
        accept
          ? `Đã đưa bé ${selected.nickname} vào lớp ${inv.classroomName}!`
          : 'Đã từ chối lời mời.',
      )
      invitations.reload()
      myClasses.reload()
      homework.reload()
    } catch (failure) {
      setError(apiError(failure))
    }
  }

  async function submitJoinRequest(e: FormEvent) {
    e.preventDefault()
    if (!selected || !requestingClass || requestBusy) return
    setRequestBusy(true)
    setRequestModalErr('')
    setFeedback('')
    setError('')
    try {
      await api.post(`/parent/classrooms/${requestingClass.id}/join-requests`, {
        studentId: selected.id,
        message: requestMsg.trim() || null,
      })
      const clsName = requestingClass.name
      setRequestMsg('')
      setRequestModalSuccess(
        `Đã gửi yêu cầu cho bé ${selected.nickname} vào ${clsName}. Vui lòng chờ giáo viên phản hồi nhé!`,
      )
      setFeedback(
        `Đã gửi yêu cầu tham gia ${clsName}, đang chờ giáo viên duyệt.`,
      )
      myRequests.reload()
    } catch (failure) {
      setRequestModalErr(apiError(failure))
    } finally {
      setRequestBusy(false)
    }
  }

  function openRequestModal(cls: PublicClassroom) {
    setRequestingClass(cls)
    setRequestMsg('')
    setRequestModalErr('')
    setRequestModalSuccess('')
  }

  function closeRequestModal() {
    if (requestBusy) return
    setRequestingClass(null)
    setRequestModalErr('')
    setRequestModalSuccess('')
  }

  return (
    <div className="page-enter">
      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            LỚP HỌC & BÀI TẬP · BÉ {selected.nickname.toLocaleUpperCase('vi')}
          </span>
          <h1>Lớp học & Bài tập về nhà</h1>
          <p>
            Tham gia lớp của giáo viên, chụp ảnh các trang vở nộp bài và xem
            điểm đánh giá theo từng đợt.
          </p>
        </div>
      </header>

      {feedback && (
        <p role="status" className="form-success">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {(invitations.data?.length ?? 0) > 0 && (
        <section className="panel parent-class-section">
          <h2>Lời mời vào lớp ({invitations.data!.length})</h2>
          <div className="invitation-list">
            {invitations.data!.map((inv) => (
              <div key={inv.id} className="invitation-row">
                <div>
                  <strong>
                    {inv.classroomName} ({gradeLabels[inv.gradeLevel]})
                  </strong>
                  <p>
                    GV {inv.teacherName} · Năm học {inv.schoolYear}
                  </p>
                </div>
                <div className="teacher-roster-btns">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void respondInvitation(inv, true)}
                  >
                    Chấp nhận cho bé {selected.nickname}
                  </button>
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => void respondInvitation(inv, false)}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel parent-class-section">
        <div className="section-heading">
          <div>
            <h2>Bài tập về nhà & Điểm số của {selected.nickname}</h2>
            <p>
              Chụp ảnh rõ từng trang bài làm rồi tải lên cho giáo viên chấm.
            </p>
          </div>
          <div className="notification-filter-tabs">
            {(['ALL', 'TIENG_VIET', 'TOAN'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={subject === s ? 'primary-button' : 'soft-button'}
                onClick={() => setSubject(s)}
              >
                {s === 'ALL' ? 'Tất cả môn' : subjectLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {homework.loading ? (
          <Loading message="Đang tải bài tập về nhà..." />
        ) : homework.error ? (
          <ErrorPanel message={homework.error} onRetry={homework.reload} />
        ) : !homework.data?.length ? (
          <p className="empty-inline-note">
            Chưa có bài tập về nhà nào được giao cho bé {selected.nickname}.
          </p>
        ) : (
          <div className="hw-submissions-list">
            {homework.data.map((item) => (
              <ParentHomeworkCard
                key={`${item.batchId}:${item.enrollmentId}`}
                item={item}
                onZoom={setZoomPage}
                onZoomLocal={setZoomLocal}
                onChanged={homework.reload}
              />
            ))}
          </div>
        )}
      </section>

      <section className="panel parent-class-section">
        <h2>Lớp bé {selected.nickname} đang tham gia</h2>
        {myClasses.data?.length ? (
          <div className="plan-items-summary">
            {myClasses.data.map((c) => (
              <span key={c.enrollmentId} className="plan-item-tag">
                <strong>{c.classroomName}</strong> · {gradeLabels[c.gradeLevel]}{' '}
                · GV {c.teacherName}
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-inline-note">
            Bé chưa tham gia lớp học nào. Nhập mã lớp hoặc tìm lớp bên dưới nhé.
          </p>
        )}

        <form className="join-code-inline" onSubmit={(e) => void joinByCode(e)}>
          <input
            type="text"
            maxLength={16}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Nhập mã lớp cô gửi (VD: ABC123)..."
          />
          <button
            type="submit"
            className="primary-button"
            disabled={joinBusy || !joinCode.trim()}
          >
            {joinBusy ? 'Đang tham gia...' : 'Vào lớp bằng mã'}
          </button>
        </form>
      </section>

      <section className="panel parent-class-section">
        <h2>Tìm danh sách lớp để tham gia</h2>
        <form
          className="plan-library-controls"
          onSubmit={(e) => {
            e.preventDefault()
            setAppliedQ(searchQ.trim())
          }}
        >
          <select
            aria-label="Lọc khối lớp"
            value={searchGrade}
            onChange={(e) => setSearchGrade(e.target.value as Grade | 'ALL')}
          >
            <option value="ALL">Tất cả khối</option>
            {gradeOptions.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>
          <div className="search-inline-row">
            <input
              type="search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Tìm tên lớp hoặc tên giáo viên..."
            />
            <button type="submit" className="soft-button">
              Tìm lớp
            </button>
          </div>
        </form>

        <div className="public-classes-grid">
          {(searchResults.data ?? []).map((cls) => {
            const alreadyJoined = (myClasses.data ?? []).some(
              (c) => c.classroomId === cls.id,
            )
            const pendingReq = (myRequests.data ?? []).some(
              (r) =>
                r.classroomId === cls.id &&
                r.studentId === selected.id &&
                r.status === 'PENDING',
            )
            return (
              <article key={cls.id} className="today-item-tile">
                <div className="today-item-top">
                  <span className="today-item-type">
                    {gradeLabels[cls.gradeLevel]}
                  </span>
                  <span className="today-item-count">{cls.studentCount} HS</span>
                </div>
                <strong>{cls.name}</strong>
                <small>
                  GV {cls.teacherName} · {cls.schoolYear}
                </small>
                {alreadyJoined ? (
                  <button type="button" className="soft-button" disabled>
                    Bé đang học lớp này
                  </button>
                ) : pendingReq ? (
                  <button type="button" className="soft-button" disabled>
                    Đã gửi · Chờ cô duyệt
                  </button>
                ) : (
                  <button
                    type="button"
                    className="soft-button"
                    onClick={() => openRequestModal(cls)}
                  >
                    Xin tham gia lớp
                  </button>
                )}
              </article>
            )
          })}
        </div>

        {(myRequests.data?.length ?? 0) > 0 && (
          <div className="my-join-requests">
            <h3>Yêu cầu tham gia đã gửi</h3>
            <ul>
              {myRequests.data!.map((r) => (
                <li key={r.id}>
                  <strong>{r.classroomName}</strong> (bé {r.studentNickname}) —{' '}
                  <span>
                    {r.status === 'PENDING'
                      ? 'Đang chờ giáo viên duyệt'
                      : r.status === 'APPROVED'
                        ? 'Đã được duyệt'
                        : 'Đã từ chối'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {requestingClass && (
        <Modal
          title={`Xin cho bé ${selected.nickname} vào ${requestingClass.name}`}
          busy={requestBusy}
          onClose={closeRequestModal}
        >
          {requestModalSuccess ? (
            <div className="account-form">
              <p role="status" className="form-success">
                {requestModalSuccess}
              </p>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={closeRequestModal}
                >
                  Đóng
                </button>
              </div>
            </div>
          ) : (
            <form
              className="account-form"
              onSubmit={(e) => void submitJoinRequest(e)}
            >
              <p className="dialog-intro">
                Giáo viên {requestingClass.teacherName} sẽ nhận được thông báo
                và duyệt yêu cầu của gia đình.
              </p>
              <label>
                Lời nhắn gửi giáo viên (tùy chọn)
                <input
                  maxLength={300}
                  value={requestMsg}
                  disabled={requestBusy}
                  onChange={(e) => setRequestMsg(e.target.value)}
                  placeholder="Ví dụ: Em là phụ huynh bé Na..."
                />
              </label>
              {requestModalErr && (
                <p role="alert" className="form-error">
                  {requestModalErr}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="soft-button"
                  disabled={requestBusy}
                  onClick={closeRequestModal}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={requestBusy}
                >
                  {requestBusy ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {zoomLocal && (
        <Modal title={zoomLocal.title} onClose={() => setZoomLocal(null)}>
          <div className="hw-zoom-wrap">
            <img
              src={zoomLocal.url}
              alt={zoomLocal.title}
              className="hw-zoom-img"
            />
          </div>
        </Modal>
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

interface PendingFile {
  id: string
  file: File
  previewUrl: string
}

function ParentHomeworkCard({
  item,
  onZoom,
  onZoomLocal,
  onChanged,
}: {
  item: ParentHomeworkItem
  onZoom: (p: HomeworkPage) => void
  onZoomLocal: (p: { title: string; url: string }) => void
  onChanged: () => void
}) {
  const [pending, setPending] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [okMsg, setOkMsg] = useState('')
  const [err, setErr] = useState('')
  const pendingRef = useRef<PendingFile[]>([])

  useEffect(() => {
    pendingRef.current = pending
  }, [pending])

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  function pickFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErr('')
    setOkMsg('')
    const maxAllowed = Math.max(0, 10 - item.pages.length - pending.length)
    const chosen = Array.from(files)
    if (chosen.length > maxAllowed) {
      setErr(
        `Tối đa 10 trang ảnh cho mỗi bài tập (hiện có thể chọn thêm tối đa ${maxAllowed} ảnh).`,
      )
    }
    const accepted = chosen.slice(0, maxAllowed)
    const next: PendingFile[] = accepted.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${file.name}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    if (next.length > 0) {
      setPending((prev) => [...prev, ...next])
    }
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((p) => p.id !== id)
    })
  }

  function movePending(index: number, delta: -1 | 1) {
    setPending((prev) => {
      const nextIdx = index + delta
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const copy = [...prev]
      const [moved] = copy.splice(index, 1)
      copy.splice(nextIdx, 0, moved)
      return copy
    })
  }

  function clearPending() {
    pending.forEach((p) => URL.revokeObjectURL(p.previewUrl))
    setPending([])
  }

  async function submitPending() {
    if (pending.length === 0 || uploading) return
    setUploading(true)
    setErr('')
    setOkMsg('')
    const form = new FormData()
    pending.forEach((p) => form.append('files', p.file))
    try {
      await api.post(
        `/parent/homework/${item.batchId}/enrollments/${item.enrollmentId}/pages`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      )
      const count = pending.length
      clearPending()
      setOkMsg(`Đã gửi ${count} ảnh bài làm cho giáo viên!`)
      onChanged()
    } catch (failure) {
      setErr(apiError(failure))
    } finally {
      setUploading(false)
    }
  }

  async function removePage(pageId: number) {
    setErr('')
    setOkMsg('')
    try {
      await api.delete(`/parent/homework/pages/${pageId}`)
      onChanged()
    } catch (failure) {
      setErr(apiError(failure))
    }
  }

  return (
    <article className="panel hw-student-card">
      <div className="hw-student-head">
        <div>
          <span className="eyebrow">
            {subjectLabels[item.subject]} · {item.classroomName} · GV{' '}
            {item.teacherName}
          </span>
          <h3>{item.title}</h3>
          {item.description && <p className="hw-description">{item.description}</p>}
          <p className="hw-meta">
            Yêu cầu: <strong>{item.requiredPages} trang ảnh</strong>
            {item.dueAt ? ` · Hạn nộp: ${formatDateTime(item.dueAt)}` : ''}
          </p>
        </div>
        <div className="hw-status-badges">
          {item.gradedPublished ? (
            <span className="plan-status-badge active">Đã có điểm</span>
          ) : item.pages.length > 0 ? (
            <span className="plan-status-badge upcoming">
              {item.late ? 'Đã nộp muộn' : 'Đã nộp'} ({item.pages.length} trang)
            </span>
          ) : (
            <span className="plan-status-badge ended">Chưa nộp</span>
          )}
        </div>
      </div>

      {item.pages.length > 0 && (
        <div className="hw-submitted-section">
          <span className="hw-strip-label">
            Ảnh đã gửi cho giáo viên ({item.pages.length} trang)
          </span>
          <div className="hw-pages-strip">
            {item.pages.map((p) => (
              <div key={p.id} className="hw-page-thumb-box">
                <button
                  type="button"
                  className="hw-page-thumb-btn"
                  onClick={() => onZoom(p)}
                >
                  <AuthImage
                    url={p.imageUrl}
                    alt={`Trang ${p.pageNumber}`}
                    className="hw-page-thumb"
                  />
                  <span>Trang {p.pageNumber}</span>
                </button>
                {!item.gradedPublished && (
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={() => void removePage(p.id)}
                  >
                    Xóa
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!item.gradedPublished && pending.length > 0 && (
        <div className="hw-pending-box">
          <div className="hw-pending-head">
            <strong>
              Ảnh vừa chọn — chưa gửi ({pending.length} ảnh)
            </strong>
            <button
              type="button"
              className="text-button danger-text"
              disabled={uploading}
              onClick={clearPending}
            >
              Bỏ chọn tất cả
            </button>
          </div>
          <p className="hw-pending-hint">
            Ba mẹ kiểm tra lại độ rõ, xóa hoặc đổi thứ tự ảnh rồi bấm{' '}
            <strong>Gửi bài cho giáo viên</strong> nhé.
          </p>
          <div className="hw-pages-strip">
            {pending.map((p, idx) => (
              <div key={p.id} className="hw-page-thumb-box">
                <button
                  type="button"
                  className="hw-page-thumb-btn"
                  onClick={() =>
                    onZoomLocal({
                      title: `Xem trước ảnh ${idx + 1} — ${p.file.name}`,
                      url: p.previewUrl,
                    })
                  }
                >
                  <img
                    src={p.previewUrl}
                    alt={`Ảnh chờ gửi ${idx + 1}`}
                    className="hw-page-thumb"
                  />
                  <span>Ảnh {idx + 1}</span>
                </button>
                <div className="hw-pending-item-actions">
                  {pending.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="text-button"
                        disabled={uploading || idx === 0}
                        title="Đưa lên trước"
                        onClick={() => movePending(idx, -1)}
                      >
                        ←
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        disabled={uploading || idx === pending.length - 1}
                        title="Đưa ra sau"
                        onClick={() => movePending(idx, 1)}
                      >
                        →
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-button danger-text"
                    disabled={uploading}
                    onClick={() => removePending(p.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!item.gradedPublished && (
        <div className="hw-upload-row">
          <label className="soft-button hw-upload-label">
            <Icon name="camera" size={17} />
            {pending.length > 0
              ? 'Chọn thêm ảnh'
              : 'Chụp / chọn ảnh trang vở'}
            <input
              type="file"
              accept="image/png,image/jpeg"
              multiple
              disabled={uploading}
              hidden
              onChange={(e) => {
                pickFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {pending.length > 0 && (
            <button
              type="button"
              className="primary-button"
              disabled={uploading}
              onClick={() => void submitPending()}
            >
              {uploading
                ? 'Đang gửi bài...'
                : `Gửi bài cho giáo viên (${pending.length} ảnh)`}
              <Icon name="arrow" size={16} />
            </button>
          )}
          <small>Hỗ trợ JPG/PNG, tối đa 10 trang (10 MB/ảnh).</small>
        </div>
      )}

      {okMsg && (
        <p role="status" className="form-success">
          {okMsg}
        </p>
      )}

      {item.gradedPublished && (
        <div className="hw-published-result">
          <div className="hw-published-head">
            <strong>
              Kết quả đánh giá:{' '}
              {item.score != null ? `${item.score} / 10 điểm` : ''}
              {item.score != null && item.rating ? ' · ' : ''}
              {item.rating ? ratingLabels[item.rating] : ''}
            </strong>
            <small>Gửi lúc {formatDateTime(item.sentToParentAt)}</small>
          </div>
          {item.teacherComment && <p>{item.teacherComment}</p>}
        </div>
      )}

      {err && (
        <p role="alert" className="form-error">
          {err}
        </p>
      )}
    </article>
  )
}
