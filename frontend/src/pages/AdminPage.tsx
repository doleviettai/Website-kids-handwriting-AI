import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../api/client'
import { useResource } from '../hooks/useResource'
import type { Account, AdminOverview, AdminTeacherDetail } from '../api/types'
import { gradeLabels } from '../data'
import { useWorkspace } from '../context/workspace-context'
import { Icon } from '../components/Icons'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteDialog } from '../components/DeleteDialog'
import { LessonCard } from './LessonsPage'

type ManageableRole = 'PARENT' | 'TEACHER'
type RoleFilter = 'ALL' | 'PARENT' | 'TEACHER' | 'ADMIN'

function roleLabel(role: Account['role']): string {
  if (role === 'ADMIN') return 'Quản trị viên'
  if (role === 'TEACHER') return 'Giáo viên'
  return 'Phụ huynh'
}

export function AdminPage() {
  const [page, setPage] = useState(0)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [viewingTeacher, setViewingTeacher] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState<Account | null>(null)
  const [notice, setNotice] = useState('')

  const summary = useResource<AdminOverview>('/admin/overview')

  const params = new URLSearchParams({ page: String(page) })
  if (roleFilter !== 'ALL') params.set('role', roleFilter)
  if (searchQuery) params.set('q', searchQuery)

  const accounts = useResource<{
    content: Account[]
    totalPages: number
    totalElements?: number
    page: number
  }>(`/admin/users?${params.toString()}`)

  const { lessons } = useWorkspace()

  function applySearch(event: FormEvent) {
    event.preventDefault()
    setPage(0)
    setSearchQuery(searchInput.trim())
  }

  function clearSearch() {
    setSearchInput('')
    setSearchQuery('')
    setPage(0)
  }

  function changeRoleFilter(next: RoleFilter) {
    setRoleFilter(next)
    setPage(0)
  }

  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">KHÔNG GIAN QUẢN TRỊ</span>
          <h1>Tổng quan NétXinh</h1>
          <p>Theo dõi tài khoản, hồ sơ bé và thư viện nội dung.</p>
        </div>
        <span className="admin-role">
          <Icon name="shield" size={18} /> Quản trị viên
        </span>
      </div>
      <div className="admin-shortcuts">
        <Link to="/quan-tri/bai-viet">
          <Icon name="chart" size={23} />
          <div>
            <strong>Bài viết & thông báo</strong>
            <span>Xem lỗi, kết quả nhận dạng và trạng thái model</span>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
        <Link to="/quan-tri/bai-hoc">
          <Icon name="book" size={23} />
          <div>
            <strong>Quản lý bài học</strong>
            <span>Thêm, sửa và sắp xếp bài học</span>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
        <Link to="/quan-tri/noi-dung">
          <Icon name="pen" size={23} />
          <div>
            <strong>Nội dung & mẫu nét</strong>
            <span>Chữ, số, từ, câu và trình vẽ mẫu</span>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
        <Link to="/quan-tri/loai-loi">
          <Icon name="heart" size={23} />
          <div>
            <strong>Loại lỗi & phản hồi</strong>
            <span>Góp ý tiếng Việt phù hợp với bé</span>
          </div>
          <Icon name="arrow" size={18} />
        </Link>
      </div>
      {summary.loading ? (
        <Loading />
      ) : summary.error ? (
        <ErrorPanel message={summary.error} onRetry={summary.reload} />
      ) : (
        <div className="stats-row admin-stats">
          {[
            {
              icon: 'user',
              value: summary.data?.users,
              label: 'Tài khoản',
              tone: 'coral',
            },
            {
              icon: 'heart',
              value: summary.data?.students,
              label: 'Hồ sơ bé',
              tone: 'mint',
            },
            {
              icon: 'book',
              value: summary.data?.lessons,
              label: 'Bài học',
              tone: 'sunny',
            },
            {
              icon: 'pen',
              value: summary.data?.submissions,
              label: 'Bài viết',
              tone: 'coral',
            },
          ].map((s) => (
            <div className="stat-card" key={s.label}>
              <div className={`stat-icon ${s.tone}`}>
                <Icon name={s.icon} />
              </div>
              <div>
                <strong>{s.value}</strong>
                <p>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <section className="panel history-panel">
        <div className="small-heading">
          <h3>Quản lý tài khoản</h3>
          <div className="teacher-roster-btns">
            <button
              type="button"
              className="primary-button"
              onClick={() => setCreating(true)}
            >
              Thêm tài khoản
            </button>
            <button className="text-button" onClick={accounts.reload}>
              Làm mới
              <Icon name="arrow" size={16} />
            </button>
          </div>
        </div>

        <div className="admin-user-toolbar">
          <div className="category-tabs" role="tablist" aria-label="Lọc theo vai trò">
            {(
              [
                ['ALL', 'Tất cả'],
                ['PARENT', 'Phụ huynh'],
                ['TEACHER', 'Giáo viên'],
                ['ADMIN', 'Quản trị viên'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={roleFilter === key}
                className={roleFilter === key ? 'active' : ''}
                onClick={() => changeRoleFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <form className="admin-user-search" onSubmit={applySearch}>
            <input
              type="search"
              className="teacher-search-input"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              aria-label="Tìm theo tên hoặc email"
            />
            <button type="submit" className="soft-button">
              Tìm
            </button>
            {searchQuery && (
              <button type="button" className="text-button" onClick={clearSearch}>
                Xóa lọc
              </button>
            )}
          </form>
        </div>

        {notice && (
          <p role="status" className="form-success">
            {notice}
          </p>
        )}
        {accounts.loading ? (
          <Loading />
        ) : accounts.error ? (
          <ErrorPanel message={accounts.error} onRetry={accounts.reload} />
        ) : !accounts.data?.content.length ? (
          <div className="empty-state">
            <h3>Chưa có tài khoản phù hợp</h3>
            <p>Thử thay đổi bộ lọc vai trò hoặc từ khóa tìm kiếm, hoặc thêm tài khoản mới.</p>
          </div>
        ) : (
          <>
            <div className="history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên hiển thị</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data.content.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName || 'Chưa đặt tên'}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role.toLowerCase()}`}>
                          {roleLabel(u.role)}
                        </span>
                      </td>
                      <td>
                        {u.role === 'ADMIN' ? (
                          <span className="admin-protected-tag">Được bảo vệ</span>
                        ) : (
                          <div className="admin-user-actions">
                            {u.role === 'TEACHER' && (
                              <button
                                type="button"
                                className="text-button"
                                onClick={() => setViewingTeacher(u)}
                              >
                                Xem lớp dạy
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => setEditing(u)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="text-button danger-link"
                              onClick={() => setDeleting(u)}
                            >
                              Xóa
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accounts.data.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="soft-button"
                  disabled={!page}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Trang trước
                </button>
                <span>
                  {page + 1}/{accounts.data.totalPages}
                </span>
                <button
                  className="soft-button"
                  disabled={page + 1 >= accounts.data.totalPages}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Trang sau
                </button>
              </div>
            )}
          </>
        )}
      </section>
      <div className="section-heading">
        <div>
          <h2>Thư viện nội dung hiện có</h2>
          <p>Danh sách nội dung đã được khởi tạo trong hệ thống.</p>
        </div>
      </div>
      {lessons.loading ? (
        <Loading />
      ) : lessons.error ? (
        <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
      ) : (
        <div className="lesson-grid connected-lessons">
          {lessons.data?.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      )}
      {(creating || editing) && (
        <UserEditorModal
          initial={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={(saved, wasEdit) => {
            setCreating(false)
            setEditing(null)
            setNotice(
              wasEdit
                ? `Đã cập nhật tài khoản ${saved.email} (${roleLabel(saved.role)}).`
                : `Đã tạo tài khoản ${roleLabel(saved.role).toLowerCase()} ${saved.email}.`,
            )
            accounts.reload()
            summary.reload()
          }}
        />
      )}
      {viewingTeacher && (
        <AdminTeacherClassroomsModal
          teacher={viewingTeacher}
          onClose={() => setViewingTeacher(null)}
        />
      )}
      {deleting && (
        <DeleteDialog
          title={`Xóa tài khoản ${roleLabel(deleting.role).toLowerCase()}?`}
          description={
            deleting.role === 'TEACHER'
              ? `Tài khoản "${deleting.fullName || deleting.email}" (${deleting.email}) sẽ bị xóa vĩnh viễn cùng toàn bộ lớp học, danh sách lớp, đợt chấm và nhận xét của giáo viên này.`
              : `Tài khoản "${deleting.fullName || deleting.email}" (${deleting.email}) sẽ bị xóa vĩnh viễn cùng toàn bộ hồ sơ bé, bài viết, mục tiêu, kế hoạch luyện tập và thông báo liên quan.`
          }
          url={`/admin/users/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            const removed = deleting
            setDeleting(null)
            setNotice(`Đã xóa tài khoản ${removed.email}.`)
            if (page > 0 && accounts.data?.content.length === 1) {
              setPage((v) => Math.max(0, v - 1))
            } else {
              accounts.reload()
            }
            summary.reload()
          }}
        />
      )}
    </div>
  )
}

function UserEditorModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Account | null
  onClose: () => void
  onSaved: (account: Account, wasEdit: boolean) => void
}) {
  const isEdit = Boolean(initial)
  const [role, setRole] = useState<ManageableRole>(
    initial?.role === 'TEACHER' ? 'TEACHER' : 'PARENT',
  )
  const [fullName, setFullName] = useState(initial?.fullName ?? '')
  const [email, setEmail] = useState(initial?.email ?? '')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (isEdit && initial) {
        const payload: {
          fullName: string
          email: string
          role: ManageableRole
          password?: string
        } = {
          fullName: fullName.trim(),
          email: email.trim(),
          role,
        }
        if (password.trim()) {
          payload.password = password
        }
        const { data } = await api.put<Account>(`/admin/users/${initial.id}`, payload)
        onSaved(data, true)
      } else {
        const { data } = await api.post<Account>('/admin/users', {
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          password,
        })
        onSaved(data, false)
      }
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
      busy={busy}
      onClose={onClose}
    >
      <form className="account-form" onSubmit={(e) => void submit(e)}>
        <label>
          Vai trò
          <select
            value={role}
            disabled={busy}
            onChange={(e) => setRole(e.target.value as ManageableRole)}
          >
            <option value="PARENT">Phụ huynh</option>
            <option value="TEACHER">Giáo viên</option>
          </select>
        </label>
        <label>
          Tên hiển thị
          <input
            required
            maxLength={100}
            value={fullName}
            disabled={busy}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={role === 'TEACHER' ? 'Ví dụ: Cô Nguyễn Thị Lan' : 'Ví dụ: Mẹ bé Minh'}
          />
        </label>
        <label>
          Email đăng nhập
          <input
            type="email"
            required
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={role === 'TEACHER' ? 'co.lan@truong.edu.vn' : 'phuhuynh@example.com'}
          />
        </label>
        <label>
          {isEdit
            ? 'Mật khẩu mới (để trống nếu giữ nguyên)'
            : 'Mật khẩu (tối thiểu 8 ký tự)'}
          <input
            type="password"
            required={!isEdit}
            minLength={isEdit && !password ? undefined : 8}
            maxLength={72}
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Nhập mật khẩu mới nếu muốn đổi' : ''}
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
            {busy ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </button>
        </div>
      </form>
    </Modal>
  )
}


function AdminTeacherClassroomsModal({
  teacher,
  onClose,
}: {
  teacher: Account
  onClose: () => void
}) {
  const detail = useResource<AdminTeacherDetail>(
    `/admin/teachers/${teacher.id}/classrooms`,
  )
  return (
    <Modal
      title={`Giáo viên ${teacher.fullName || teacher.email}`}
      onClose={onClose}
    >
      <p className="dialog-intro">Email: {teacher.email}</p>
      {detail.loading ? (
        <Loading message="Đang tải danh sách lớp..." />
      ) : detail.error ? (
        <ErrorPanel message={detail.error} onRetry={detail.reload} />
      ) : !detail.data?.classrooms.length ? (
        <p className="empty-inline-note">
          Giáo viên này chưa tạo lớp học nào.
        </p>
      ) : (
        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tên lớp</th>
                <th>Khối</th>
                <th>Năm học</th>
                <th>Mã lớp</th>
                <th>Sĩ số</th>
                <th>Đợt BT</th>
              </tr>
            </thead>
            <tbody>
              {detail.data.classrooms.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.name}</strong>
                  </td>
                  <td>{gradeLabels[c.gradeLevel]}</td>
                  <td>{c.schoolYear}</td>
                  <td>
                    <code>{c.joinCode}</code>
                  </td>
                  <td>{c.studentCount}</td>
                  <td>{c.batchCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
