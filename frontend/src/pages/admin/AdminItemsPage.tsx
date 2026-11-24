import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { AdminItem } from '../../api/types'
import { useResource } from '../../hooks/useResource'
import { useWorkspace } from '../../context/workspace-context'
import { typeLabels } from '../../data'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Icon } from '../../components/Icons'
import { DeleteDialog } from '../../components/DeleteDialog'
import { ItemEditor } from './ItemEditor'

export function AdminItemsPage() {
  const { lessons } = useWorkspace(),
    items = useResource<AdminItem[]>('/admin/items')
  const [query, setQuery] = useSearchParams()
  const [editing, setEditing] = useState<AdminItem | 'new' | null>(null),
    [deleting, setDeleting] = useState<AdminItem | null>(null)
  const [notice, setNotice] = useState('')
  const lessonFilter = query.get('lesson') ?? 'ALL',
    type = query.get('type') ?? 'ALL',
    search = query.get('q') ?? ''
  function filter(key: string, value: string) {
    const next = new URLSearchParams(query)
    if (value && value !== 'ALL') next.set(key, value)
    else next.delete(key)
    setQuery(next, { replace: true })
  }
  const rows =
    items.data?.filter(
      (item) =>
        (lessonFilter === 'ALL' ||
          (lessonFilter === 'none'
            ? item.lessonId === null
            : item.lessonId === Number(lessonFilter))) &&
        (type === 'ALL' || item.itemType === type) &&
        item.textValue
          .toLocaleLowerCase('vi')
          .includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? []
  function refresh(message: string) {
    items.reload()
    lessons.reload()
    setNotice(message)
  }
  return (
    <div className="page-enter admin-content-page">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">TỪNG CHỮ NHỎ, MỘT BÀI HỌC HAY</span>
          <h1>Nội dung & mẫu nét</h1>
          <p>
            Quản lý chữ cái, chữ số, chữ ghép, từ và câu; vẽ mẫu nét trực tiếp
            cho từng nội dung.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setEditing('new')}
          disabled={!lessons.data}
        >
          <Icon name="pen" size={19} /> Thêm nội dung
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
            aria-label="Tìm nội dung"
            placeholder="Tìm chữ, số, từ hoặc câu..."
            value={search}
            onChange={(e) => filter('q', e.target.value)}
          />
        </label>
        <select
          value={lessonFilter}
          aria-label="Lọc nội dung theo bài học"
          onChange={(e) => filter('lesson', e.target.value)}
        >
          <option value="ALL">Tất cả bài học</option>
          <option value="none">Chưa xếp bài</option>
          {lessons.data?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.title}
            </option>
          ))}
        </select>
        <select
          value={type}
          aria-label="Lọc loại nội dung"
          onChange={(e) => filter('type', e.target.value)}
        >
          <option value="ALL">Tất cả loại</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          className="text-button"
          onClick={() => {
            items.reload()
            lessons.reload()
          }}
        >
          Làm mới
          <Icon name="arrow" size={16} />
        </button>
      </div>
      {lessons.error && (
        <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
      )}{' '}
      {items.loading ? (
        <Loading message="Đang tải nội dung..." />
      ) : items.error ? (
        <ErrorPanel message={items.error} onRetry={items.reload} />
      ) : (
        <section className="panel admin-table-panel">
          <div className="small-heading">
            <h3>{rows.length} nội dung</h3>
            <span>Chọn sửa để vẽ hoặc chỉnh mẫu nét</span>
          </div>
          <div className="history-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th>Bài học</th>
                  <th>Loại / độ khó</th>
                  <th>Mẫu nét</th>
                  <th>Thứ tự</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="content-text-cell">
                      <strong>{item.textValue}</strong>
                    </td>
                    <td>
                      {lessons.data?.find((l) => l.id === item.lessonId)
                        ?.title ?? 'Chưa xếp bài'}
                    </td>
                    <td>
                      {typeLabels[item.itemType]}
                      <small>Độ khó {item.difficulty ?? 1}/3</small>
                    </td>
                    <td>
                      {item.template ? (
                        <span className="template-ready">
                          <Icon name="check" size={14} />
                          {item.template.strokes.length} nét
                        </span>
                      ) : (
                        <span>Chưa có mẫu</span>
                      )}
                    </td>
                    <td>{item.sortOrder ?? 0}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="soft-button"
                          aria-label={`Sửa nội dung ${item.textValue}`}
                          onClick={() => setEditing(item)}
                        >
                          <Icon name="pen" size={16} /> Sửa
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Xóa nội dung ${item.textValue}`}
                          onClick={() => setDeleting(item)}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="empty-state">
              <Icon name="letter" size={38} />
              <h3>Chưa có nội dung phù hợp</h3>
              <p>Đổi bộ lọc hoặc thêm một nội dung mới vào thư viện.</p>
            </div>
          )}
        </section>
      )}
      {editing && lessons.data && (
        <ItemEditor
          item={editing === 'new' ? null : editing}
          lessons={lessons.data}
          initialLesson={Number(lessonFilter) > 0 ? Number(lessonFilter) : null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            refresh('Đã lưu nội dung và mẫu nét.')
          }}
        />
      )}{' '}
      {deleting && (
        <DeleteDialog
          title={`Xóa nội dung “${deleting.textValue}”?`}
          description="Nội dung chưa có bài viết hoặc tiến độ sẽ được xóa khỏi thư viện. Nội dung đã có lịch sử học được giữ lại để bảo toàn kết quả của bé."
          url={`/admin/items/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            refresh('Đã xóa nội dung khỏi thư viện.')
          }}
        />
      )}
    </div>
  )
}
