import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useResource } from '../../hooks/useResource'
import type { AiStatus, ReviewPage } from '../../api/types'
import { ErrorPanel, Loading } from '../../components/Feedback'

export function AdminReviewsPage() {
  const [page, setPage] = useState(0),
    [onlyErrors, setOnlyErrors] = useState(true)
  const reviews = useResource<ReviewPage>(
    `/admin/reviews?page=${page}&onlyErrors=${onlyErrors}`,
  )
  const ai = useResource<AiStatus>('/ai/status')
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">ĐỒNG HÀNH CÙNG GIA ĐÌNH</span>
          <h1>Bài viết cần xem lại</h1>
          <p>
            Thông báo lỗi và kết quả nhận dạng của các bé. Kết quả độ tin cậy
            thấp cần được kiểm tra trước khi nhắc bé.
          </p>
        </div>
        <button
          className="soft-button"
          onClick={() => {
            reviews.reload()
            ai.reload()
          }}
        >
          Làm mới
        </button>
      </div>
      <section className="panel ai-status-panel">
        <h3>Trạng thái model</h3>
        {ai.loading ? (
          <Loading />
        ) : ai.error ? (
          <ErrorPanel message={ai.error} onRetry={ai.reload} />
        ) : (
          <>
            <p>
              {ai.data?.status === 'UP'
                ? 'Ba model đang sẵn sàng'
                : (ai.data?.message ?? 'Có model chưa sẵn sàng')}
            </p>
            {Object.entries(ai.data?.models ?? {}).map(([task, model]) => (
              <div key={task}>
                <strong>{task}</strong>
                <span>{model.ready ? 'Sẵn sàng' : model.message}</span>
              </div>
            ))}
          </>
        )}
      </section>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={onlyErrors}
          onChange={(e) => {
            setOnlyErrors(e.target.checked)
            setPage(0)
          }}
        />{' '}
        Chỉ xem bài có điểm cần xem lại
      </label>
      {reviews.loading ? (
        <Loading />
      ) : reviews.error ? (
        <ErrorPanel message={reviews.error} onRetry={reviews.reload} />
      ) : (
        <section className="panel history-panel">
          <h3>{reviews.data?.totalElements ?? 0} bài viết</h3>
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bé</th>
                  <th>Yêu cầu / nhận dạng</th>
                  <th>Điểm</th>
                  <th>Thông báo</th>
                  <th>Ngày gửi</th>
                  <th>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {reviews.data?.content.map((row) => (
                  <tr key={row.id}>
                    <td>{row.nickname}</td>
                    <td>
                      <strong>{row.expectedText}</strong>
                      <small>Đọc: {row.predictedText || '(chưa rõ)'}</small>
                    </td>
                    <td>{row.totalScore ?? '—'}</td>
                    <td>{row.errors} điểm cần xem lại</td>
                    <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
                    <td>
                      <Link className="soft-button" to={`/bai-viet/${row.id}`}>
                        Xem bài
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!reviews.data?.content.length && (
            <div className="empty-state">
              <h3>Chưa có bài viết trong nhóm này</h3>
            </div>
          )}
          <div className="pagination">
            <button
              className="soft-button"
              disabled={!page}
              onClick={() => setPage((v) => v - 1)}
            >
              Trang trước
            </button>
            <span>
              {page + 1}/{Math.max(reviews.data?.totalPages ?? 1, 1)}
            </span>
            <button
              className="soft-button"
              disabled={page + 1 >= (reviews.data?.totalPages ?? 0)}
              onClick={() => setPage((v) => v + 1)}
            >
              Trang sau
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
