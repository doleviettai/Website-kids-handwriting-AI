import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, apiError } from '../api/client'
import type { Student, StudentInput } from '../api/types'
import type { Grade } from '../types'
import { gradeLabels } from '../data'
import { useWorkspace } from '../context/workspace-context'
import { Mascot } from '../components/Artwork'
import { Icon } from '../components/Icons'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Modal } from '../components/Modal'

function StudentEditor({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    const input: StudentInput = {
      nickname: String(values.get('nickname')).trim().normalize('NFC'),
      birthYear: Number(values.get('birthYear')),
      gradeLevel: values.get('gradeLevel') as Grade,
    }
    if (!input.nickname) {
      setError('Ba mẹ nhập biệt danh của bé nhé.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (student) await api.put(`/students/${student.id}`, input)
      else await api.post('/students', input)
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={student ? 'Chỉnh sửa hồ sơ bé' : 'Thêm một người bạn nhỏ'}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-intro">
        Chỉ cần biệt danh, năm sinh và cấp học để chuẩn bị nội dung phù hợp với
        con.
      </p>
      <form className="account-form" onSubmit={submit}>
        <label>
          Biệt danh của bé
          <input
            name="nickname"
            required
            autoFocus
            minLength={1}
            maxLength={50}
            defaultValue={student?.nickname ?? ''}
            placeholder="Ví dụ: Bông, Sóc, Mít..."
            disabled={busy}
          />
        </label>
        <div className="form-grid">
          <label>
            Năm sinh
            <input
              name="birthYear"
              type="number"
              min={2008}
              max={new Date().getFullYear()}
              defaultValue={student?.birthYear ?? new Date().getFullYear() - 5}
              required
              disabled={busy}
            />
          </label>
          <label>
            Cấp học
            <select
              name="gradeLevel"
              aria-label="Cấp học"
              defaultValue={student?.gradeLevel ?? 'MAU_GIAO'}
              disabled={busy}
            >
              <option value="MAU_GIAO">Mẫu giáo</option>
              <option value="LOP_1">Lớp 1</option>
            </select>
          </label>
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
            onClick={onClose}
            disabled={busy}
          >
            Để sau
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu hồ sơ bé'}
            <Icon name="check" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  )
}

function DeleteStudent({
  student,
  onClose,
  onDeleted,
}: {
  student: Student
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await api.delete(`/students/${student.id}`)
      onDeleted()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={`Xóa hồ sơ ${student.nickname}?`}
      onClose={onClose}
      busy={busy}
    >
      <p className="dialog-intro">
        Hồ sơ chưa có lịch sử học sẽ được xóa khỏi tài khoản. Nếu bé đã có bài
        viết, hệ thống sẽ giữ hồ sơ để bảo toàn hành trình của con.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="soft-button" disabled={busy} onClick={onClose}>
          Giữ lại hồ sơ
        </button>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? 'Đang xóa...' : 'Xóa hồ sơ'}
        </button>
      </div>
    </Modal>
  )
}

export function StudentsPage() {
  const { students, selected, choose } = useWorkspace(),
    navigate = useNavigate()
  const [editor, setEditor] = useState<Student | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Student | null>(null)
  const [notice, setNotice] = useState('')
  function saved() {
    setEditor(null)
    students.reload()
    setNotice('Hồ sơ bé đã được lưu. Ba mẹ chọn bé để bắt đầu nhé!')
  }
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">MỖI BÉ MỘT HÀNH TRÌNH RIÊNG</span>
          <h1>Hôm nay ai học cùng Pip?</h1>
          <p>Chọn hồ sơ của bé, cùng mở ra một ngày học thật vui.</p>
        </div>
        <button className="primary-button" onClick={() => setEditor('new')}>
          <Icon name="user" size={19} /> Thêm hồ sơ bé
        </button>
      </div>
      {notice && (
        <p className="success-notice" role="status">
          <Icon name="check" size={18} />
          {notice}
        </p>
      )}
      {students.loading ? (
        <Loading message="Đang tải hồ sơ của gia đình..." />
      ) : students.error ? (
        <ErrorPanel message={students.error} onRetry={students.reload} />
      ) : (
        <>
          <div className="student-grid">
            {students.data?.map((student, index) => (
              <article
                key={student.id}
                className={`student-card panel tone-${index % 4} ${selected?.id === student.id ? 'selected-student' : ''}`}
              >
                <div className="student-card-top">
                  <span>
                    {selected?.id === student.id ? (
                      <>
                        <Icon name="check" size={14} /> Đang chọn
                      </>
                    ) : (
                      'Bạn nhỏ của Pip'
                    )}
                  </span>
                  <div>
                    <button
                      className="icon-button"
                      onClick={() => setEditor(student)}
                      aria-label={`Sửa hồ sơ ${student.nickname}`}
                    >
                      <Icon name="pen" size={18} />
                    </button>
                    <button
                      className="icon-button"
                      onClick={() => setDeleting(student)}
                      aria-label={`Xóa hồ sơ ${student.nickname}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </div>
                <div className="student-avatar">
                  <Mascot waving={index % 2 === 0} />
                </div>
                <h2>{student.nickname}</h2>
                <p>
                  {gradeLabels[student.gradeLevel]}
                  {student.birthYear ? ` · Sinh năm ${student.birthYear}` : ''}
                </p>
                <button
                  className={
                    selected?.id === student.id
                      ? 'primary-button'
                      : 'soft-button'
                  }
                  onClick={() => {
                    choose(student.id)
                    navigate('/')
                  }}
                >
                  Vào góc học tập
                  <Icon name="arrow" size={18} />
                </button>
              </article>
            ))}
          </div>
          {!students.data?.length && (
            <section className="onboarding-empty panel">
              <Mascot waving />
              <div>
                <span className="eyebrow">GIA ĐÌNH MÌNH BẮT ĐẦU NHÉ</span>
                <h2>Một góc học tập dành riêng cho con</h2>
                <p>
                  Ba mẹ thêm hồ sơ đầu tiên để Pip chuẩn bị bài học theo cấp của
                  bé. Mỗi bé có hồ sơ và hành trình riêng.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setEditor('new')}
                >
                  Tạo hồ sơ đầu tiên
                  <Icon name="arrow" size={18} />
                </button>
              </div>
            </section>
          )}
        </>
      )}
      <div className="family-note">
        <Icon name="shield" size={23} />
        <p>
          Hồ sơ được lưu trong tài khoản của ba mẹ. Khi đăng nhập lại, gia đình
          có thể tiếp tục với các hồ sơ đã tạo.
        </p>
      </div>
      {editor && (
        <StudentEditor
          key={editor === 'new' ? 'new' : editor.id}
          student={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}{' '}
      {deleting && (
        <DeleteStudent
          student={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            students.reload()
            setNotice('Đã xóa hồ sơ bé.')
          }}
        />
      )}
    </div>
  )
}
