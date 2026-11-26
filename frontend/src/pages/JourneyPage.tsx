import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../context/workspace-context'
import { useResource } from '../hooks/useResource'
import type { HistoryPage, Attention, ParentTeacherReport } from '../api/types'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Icon } from '../components/Icons'
import { Mascot } from '../components/Artwork'

const RATING_LABELS: Record<string, string> = {
  HOAN_THANH_TOT: 'Hoàn thành tốt',
  HOAN_THANH: 'Hoàn thành',
  CAN_CO_GANG: 'Cần cố gắng',
}

export function JourneyPage({ parent = false }: { parent?: boolean }) {
  const { students, selected, overview } = useWorkspace()
  const [page, setPage] = useState(0)
  const history = useResource<HistoryPage>(
    selected ? `/students/${selected.id}/submissions?page=${page}` : null,
  )
  const attention = useResource<Attention[]>(
    selected ? `/students/${selected.id}/attention` : null,
  )
  const teacherReports = useResource<ParentTeacherReport[]>(
    parent && selected ? `/students/${selected.id}/teacher-reports` : null,
  )
  if (students.loading) return <Loading />
  if (students.error)
    return <ErrorPanel message={students.error} onRetry={students.reload} />
  if (!selected)
    return (
      <div className="empty-state panel">
        <Icon name="user" size={40} />
        <h2>Gia đình mình thêm hồ sơ bé nhé</h2>
        <p>Chọn hồ sơ để xem hành trình của riêng con.</p>
        <Link className="primary-button" to="/ho-so">
          Tạo hồ sơ bé
          <Icon name="arrow" size={18} />
        </Link>
      </div>
    )
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - 6 + index)
    const date = day.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    return {
      label: day.toLocaleDateString('vi-VN', { weekday: 'short' }),
      count:
        overview.data?.activity.find((a) => a.date === date)?.attempts ?? 0,
    }
  })
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {parent ? 'CÙNG CON LỚN KHÔN' : 'MỖI NGÀY MỘT CHÚT TIẾN BỘ'}
          </span>
          <h1>
            {parent
              ? `Ba mẹ đồng hành cùng ${selected.nickname}`
              : `Hành trình của ${selected.nickname}`}
          </h1>
          <p>Mỗi cố gắng nhỏ đều là một bước tiến đáng yêu.</p>
        </div>
        <Link className="soft-button" to="/ho-so">
          <Icon name="user" size={18} /> Đổi hồ sơ
        </Link>
      </div>
      {parent && (
        <section className="panel teacher-reports-panel">
          <div className="small-heading">
            <h3>Báo cáo từ giáo viên chủ nhiệm</h3>
            <Link to="/ke-hoach" className="text-button">
              Lập kế hoạch luyện thêm
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          {teacherReports.loading ? (
            <Loading message="Đang tải báo cáo của cô..." />
          ) : teacherReports.error ? (
            <ErrorPanel
              message={teacherReports.error}
              onRetry={teacherReports.reload}
            />
          ) : teacherReports.data?.length ? (
            <div className="teacher-report-list">
              {teacherReports.data.map((r) => (
                <article key={r.evaluationId} className="teacher-report-item">
                  <div className="teacher-report-head">
                    <div>
                      <strong>{r.batchTitle}</strong>
                      <small>
                        {r.classroomName} · {r.teacherName} · Ngày {r.batchDate}
                      </small>
                    </div>
                    {r.rating && (
                      <span
                        className={`plan-status-badge ${r.rating === 'HOAN_THANH_TOT' ? 'active' : r.rating === 'CAN_CO_GANG' ? 'ended' : 'upcoming'}`}
                      >
                        {RATING_LABELS[r.rating] ?? r.rating}
                      </span>
                    )}
                  </div>
                  {r.teacherComment && <p>{r.teacherComment}</p>}
                </article>
              ))}
            </div>
          ) : (
            <p className="assessment-note">
              Chưa có báo cáo từ giáo viên. Ba mẹ có thể vào{' '}
              <Link to="/ho-so">Hồ sơ các bé</Link> để nhập mã mời lớp của cô
              giáo nhé.
            </p>
          )}
        </section>
      )}
      <section className="panel attention-panel">
        <div className="small-heading">
          <h3>Ba mẹ cùng bé xem lại</h3>
          <button className="text-button" onClick={attention.reload}>
            Làm mới
          </button>
        </div>
        {attention.loading ? (
          <Loading />
        ) : attention.error ? (
          <ErrorPanel message={attention.error} onRetry={attention.reload} />
        ) : attention.data?.length ? (
          <>
            <p className="assessment-note">
              Đây là các dấu hiệu hệ thống ghi nhận, có thể do máy đọc chưa rõ.
              Ba mẹ đối chiếu bài thật trước khi nhắc bé.
            </p>
            <div className="attention-list">
              {attention.data.map((a) => (
                <article key={a.code}>
                  <strong>
                    {a.nameVi} · {a.occurrences} bài
                  </strong>
                  <p>{a.feedback}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="assessment-note">
            Chưa có thông báo cần xem lại trong hồ sơ này.
          </p>
        )}
      </section>
      {overview.loading ? (
        <Loading message="Đang tải hành trình của bé..." />
      ) : overview.error ? (
        <ErrorPanel message={overview.error} onRetry={overview.reload} />
      ) : (
        <>
          <div className="stats-row">
            {[
              {
                icon: 'pen',
                value: overview.data?.submissions ?? 0,
                label: 'Bài luyện viết',
                tone: 'coral',
              },
              {
                icon: 'book',
                value: overview.data?.masteredItems ?? 0,
                label: 'Nội dung đã thuộc',
                tone: 'mint',
              },
              {
                icon: 'star',
                value:
                  overview.data?.averageScore == null
                    ? '—'
                    : Math.round(overview.data.averageScore),
                label: 'Điểm trung bình',
                tone: 'sunny',
              },
            ].map((stat) => (
              <div className="stat-card" key={stat.label}>
                <div className={`stat-icon ${stat.tone}`}>
                  <Icon name={stat.icon} />
                </div>
                <div>
                  <strong>{stat.value}</strong>
                  <p>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="progress-overview">
            <section className="panel activity-panel">
              <div className="small-heading">
                <h3>Một tuần của bé</h3>
                <span>7 ngày gần nhất</span>
              </div>
              <div className="activity-chart">
                {days.map((day, index) => (
                  <div className="activity-day" key={index}>
                    <span>{day.count}</span>
                    <div className="bar-area">
                      <div
                        className={index === 6 ? 'today-bar' : ''}
                        style={{
                          height: `${day.count ? Math.max(10, (day.count / Math.max(...days.map((d) => d.count), 1)) * 100) : 3}%`,
                        }}
                      />
                    </div>
                    <small>{day.label}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel progress-note">
              <Icon name="leaf" size={30} />
              <h3>Nhìn vào sự cố gắng của con</h3>
              <p>
                Ba mẹ cùng con làm quen chữ mỗi ngày. Một lời khen nhỏ sẽ giúp
                con tự tin hơn rất nhiều.
              </p>
              <span>
                Chọn bài viết bên dưới để xem nhận dạng, mẫu nét và các điểm cần
                ba mẹ cùng bé kiểm tra.
              </span>
            </section>
          </div>
        </>
      )}
      <section className="panel history-panel">
        <div className="small-heading">
          <h3>Những trang viết của bé</h3>
          <button
            className="text-button"
            onClick={() => {
              history.reload()
              overview.reload()
              attention.reload()
            }}
          >
            Làm mới
            <Icon name="arrow" size={16} />
          </button>
        </div>
        {history.loading ? (
          <Loading message="Đang tải lịch sử..." />
        ) : history.error ? (
          <ErrorPanel message={history.error} onRetry={history.reload} />
        ) : history.data?.content.length ? (
          <>
            <div className="history-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nội dung</th>
                    <th>Cách luyện</th>
                    <th>Ngày viết</th>
                    <th>Điểm</th>
                    <th>Chi tiết / phản hồi</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.content.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.expectedText}</strong>
                      </td>
                      <td>
                        {row.source === 'TOUCH' ? 'Màn hình' : 'Chụp ảnh'}
                      </td>
                      <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
                      <td>{row.totalScore ?? 'Chưa có đánh giá'}</td>
                      <td>
                        <Link
                          to={`/bai-viet/${row.id}`}
                          className="soft-button"
                        >
                          Xem bài viết
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button
                className="soft-button"
                disabled={page === 0}
                onClick={() => setPage((v) => v - 1)}
              >
                Trang trước
              </button>
              <span>
                {page + 1}/{history.data.totalPages}
              </span>
              <button
                className="soft-button"
                disabled={page + 1 >= history.data.totalPages}
                onClick={() => setPage((v) => v + 1)}
              >
                Trang sau
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Icon name="book" size={42} />
            <h3>Trang đầu tiên đang chờ bé</h3>
            <p>
              Hiện chưa có bài viết trong hồ sơ này. Mình cùng khám phá thư viện
              trước nhé!
            </p>
            <Link to="/bai-hoc" className="primary-button">
              Khám phá bài học
              <Icon name="arrow" size={18} />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

export function AchievementsPage() {
  const { selected, students, overview } = useWorkspace()
  if (students.loading || overview.loading) return <Loading />
  if (students.error || overview.error)
    return (
      <ErrorPanel
        message={students.error ?? overview.error!}
        onRetry={() => {
          students.reload()
          overview.reload()
        }}
      />
    )
  const count = overview.data?.submissions ?? 0
  const milestones = [
    {
      target: 1,
      icon: 'leaf',
      title: 'Nét bút đầu tiên',
      detail: 'Hoàn thành bài luyện đầu tiên',
      color: 'mint',
    },
    {
      target: 5,
      icon: 'pen',
      title: 'Đôi tay chăm chỉ',
      detail: 'Hoàn thành 5 bài luyện',
      color: 'coral',
    },
    {
      target: 10,
      icon: 'book',
      title: 'Bạn nhỏ kiên trì',
      detail: 'Hoàn thành 10 bài luyện',
      color: 'sky',
    },
    {
      target: 20,
      icon: 'star',
      title: 'Ngôi sao bền bỉ',
      detail: 'Hoàn thành 20 bài luyện',
      color: 'grape',
    },
  ]
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">GIEO CHĂM CHỈ, GẶT NIỀM VUI</span>
          <h1>Vườn thành tích{selected ? ` của ${selected.nickname}` : ''}</h1>
          <p>Mỗi huy hiệu là một dấu mốc trên hành trình của bé.</p>
        </div>
      </div>
      <section className="achievement-banner">
        <Mascot waving />
        <div>
          <h2>
            {count
              ? 'Pip rất tự hào về bé!'
              : 'Cùng gieo những hạt giống đầu tiên!'}
          </h2>
          <p>
            {selected
              ? 'Huy hiệu sẽ nở hoa khi bé hoàn thành các bài luyện.'
              : 'Ba mẹ tạo hồ sơ bé để bắt đầu hành trình nhé.'}
          </p>
        </div>
      </section>
      <div className="award-grid">
        {milestones.map((m) => (
          <article
            key={m.target}
            className={`award-card panel ${m.color} ${count >= m.target ? 'earned' : ''}`}
          >
            <div className="award-medal">
              <Icon name={m.icon} size={46} />
              <span>✦</span>
            </div>
            <h3>{m.title}</h3>
            <p>{m.detail}</p>
            <div className="progress-track">
              <span
                style={{ width: `${Math.min((count / m.target) * 100, 100)}%` }}
              />
            </div>
            <small>
              {count >= m.target
                ? 'Đã đạt được · Bé thật tuyệt!'
                : `${Math.min(count, m.target)}/${m.target} · Đang chờ bé`}
            </small>
          </article>
        ))}
      </div>
    </div>
  )
}
