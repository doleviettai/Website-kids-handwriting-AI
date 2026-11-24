import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import type { Account, AdminOverview } from '../api/types'
import { useWorkspace } from '../context/workspace-context'
import { Icon } from '../components/Icons'
import { ErrorPanel, Loading } from '../components/Feedback'
import { LessonCard } from './LessonsPage'

export function AdminPage() {
  const [page, setPage] = useState(0)
  const summary = useResource<AdminOverview>('/admin/overview')
  const accounts = useResource<{
    content: Account[]
    totalPages: number
    page: number
  }>(`/admin/users?page=${page}`)
  const { lessons } = useWorkspace()
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
          <h3>Tài khoản trong hệ thống</h3>
          <button className="text-button" onClick={accounts.reload}>
            Làm mới
            <Icon name="arrow" size={16} />
          </button>
        </div>
        {accounts.loading ? (
          <Loading />
        ) : accounts.error ? (
          <ErrorPanel message={accounts.error} onRetry={accounts.reload} />
        ) : (
          <>
            <div className="history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tên hiển thị</th>
                    <th>Email</th>
                    <th>Vai trò</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data?.content.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName || 'Chưa đặt tên'}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.role === 'ADMIN' ? 'Quản trị viên' : 'Phụ huynh'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accounts.data && accounts.data.totalPages > 1 && (
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
    </div>
  )
}
