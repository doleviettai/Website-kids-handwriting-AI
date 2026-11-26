import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ApiLesson } from '../../api/types'
import { useWorkspace } from '../../context/workspace-context'
import { gradeLabels } from '../../data'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { DeleteDialog } from '../../components/DeleteDialog'
import { LessonEditor } from './LessonEditor'

export function AdminLessonsPage() {
  const { lessons } = useWorkspace()
  const [editing, setEditing] = useState<ApiLesson | 'new' | null>(null),
    [deleting, setDeleting] = useState<ApiLesson | null>(null)
  const [query, setQuery] = useSearchParams()
  const search = query.get('q') ?? '',
    grade = query.get('grade') ?? 'ALL'
  const [notice, setNotice] = useState('')
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(query)
    if (value && value !== 'ALL') next.set(key, value)
    else next.delete(key)
    setQuery(next, { replace: true })
  }
  const rows =
    lessons.data?.filter(
      (l) =>
        (grade === 'ALL' || l.gradeLevel === grade) &&
        l.title
          .toLocaleLowerCase('vi')
          .includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? []
  return (
    <div className="page-enter admin-content-page">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">SẮP XẾP HÀNH TRÌNH HỌC</span>
          <h1>Quản lý bài học</h1>
          <p>
            Tạo các bài học nhỏ theo cấp học, thêm nội dung và sắp xếp thứ tự
            hiển thị.
          </p>
        </div>
        <button className="primary-button" onClick={() => setEditing('new')}>
          <Icon name="book" size={19} /> Thêm bài học
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
            aria-label="Tìm bài học quản trị"
            placeholder="Tìm theo tên bài học..."
            value={search}
            onChange={(e) => setFilter('q', e.target.value)}
          />
        </label>
        <select
          aria-label="Lọc cấp học quản trị"
          value={grade}
          onChange={(e) => setFilter('grade', e.target.value)}
        >
          <option value="ALL">Tất cả cấp học</option>
          <option value="MAU_GIAO">Mẫu giáo</option>
          <option value="LOP_1">Lớp 1</option>
          <option value="LOP_2">Lớp 2</option>
          <option value="LOP_3">Lớp 3</option>
          <option value="LOP_4">Lớp 4</option>
          <option value="LOP_5">Lớp 5</option>
        </select>
        <button className="text-button" onClick={lessons.reload}>
          Làm mới
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {lessons.loading ? (
        <Loading message="Đang tải bài học..." />
      ) : lessons.error ? (
        <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
      ) : (
        <div className="admin-lesson-grid">
          {rows.map((lesson) => (
            <article className="panel admin-lesson-card" key={lesson.id}>
              <div className="admin-lesson-top">
                <span>
                  <Icon name="book" size={19} />
                  {gradeLabels[lesson.gradeLevel]}
                </span>
                <span>Thứ tự {lesson.sortOrder ?? 0}</span>
              </div>
              <h2>{lesson.title}</h2>
              <p>{lesson.items.length} nội dung trong bài</p>
              <div className="lesson-letter-preview">
                {lesson.items.slice(0, 5).map((item) => (
                  <span key={item.id}>{item.textValue}</span>
                ))}
                {lesson.items.length > 5 && (
                  <small>+{lesson.items.length - 5}</small>
                )}
                {!lesson.items.length && (
                  <small>Chưa có nội dung, hãy thêm nội dung đầu tiên.</small>
                )}
              </div>
              <div className="admin-card-actions">
                <Link
                  className="soft-button"
                  to={`/quan-tri/noi-dung?lesson=${lesson.id}`}
                >
                  Quản lý nội dung
                  <Icon name="arrow" size={16} />
                </Link>
                <button
                  className="icon-button"
                  aria-label={`Sửa bài học ${lesson.title}`}
                  onClick={() => setEditing(lesson)}
                >
                  <Icon name="pen" size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label={`Xóa bài học ${lesson.title}`}
                  onClick={() => setDeleting(lesson)}
                >
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </article>
          ))}
          {!rows.length && (
            <div className="empty-state panel">
              <Icon name="book" size={38} />
              <h3>Chưa tìm thấy bài học</h3>
              <p>Thử đổi bộ lọc hoặc thêm một bài học mới.</p>
            </div>
          )}
        </div>
      )}
      {editing && (
        <LessonEditor
          lesson={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            lessons.reload()
            setNotice('Đã lưu bài học vào thư viện.')
          }}
        />
      )}{' '}
      {deleting && (
        <DeleteDialog
          title={`Xóa bài học “${deleting.title}”?`}
          description={`Xóa vĩnh viễn bài học này cùng ${deleting.items.length} nội dung trong bài. Tất cả bài viết, kết quả nhận dạng, lỗi và tiến độ của các bé liên quan đến bài học cũng sẽ bị xóa. Không thể hoàn tác thao tác này.`}
          url={`/admin/lessons/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            lessons.reload()
            setNotice(
              'Đã xóa bài học, nội dung và toàn bộ lịch sử, lỗi, tiến độ liên quan.',
            )
          }}
        />
      )}
    </div>
  )
}
