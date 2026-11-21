import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { Icon } from './components/Icons'
import { HeroArtwork, LessonArt, Mascot } from './components/Artwork'
import { Practice } from './components/Practice'
import { categories, gradeLabels, lessons, typeLabels } from './data'
import { useLocalStorage } from './hooks/useLocalStorage'
import type { Grade, ItemType, Lesson, Profile, Submission } from './types'
import './App.css'

type PageProps = { profile: Profile; submissions: Submission[] }
const navigation = [
  { to: '/', icon: 'home', label: 'Góc học tập', end: true },
  { to: '/bai-hoc', icon: 'book', label: 'Bài học của bé' },
  { to: '/luyen-viet', icon: 'pen', label: 'Luyện viết tự do' },
  { to: '/thanh-tich', icon: 'trophy', label: 'Vườn thành tích' },
  { to: '/tien-do', icon: 'chart', label: 'Hành trình của bé' },
]
const localDay = (value: string) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

function useSummary(submissions: Submission[]) {
  const today = localDay(new Date().toISOString())
  const todayCount = submissions.filter(
    (s) => localDay(s.created_at) === today,
  ).length
  const days = new Set(submissions.map((s) => localDay(s.created_at)))
  let streak = 0
  const day = new Date()
  if (!days.has(localDay(day.toISOString()))) day.setDate(day.getDate() - 1)
  while (days.has(localDay(day.toISOString()))) {
    streak++
    day.setDate(day.getDate() - 1)
  }
  return {
    todayCount,
    streak,
    practiced: new Set(submissions.map((s) => s.item_id)).size,
  }
}

function LessonCard({
  lesson,
  submissions,
}: {
  lesson: Lesson
  submissions: Submission[]
}) {
  const navigate = useNavigate()
  const count = new Set(
    submissions.filter((s) => s.lesson_id === lesson.id).map((s) => s.item_id),
  ).size
  return (
    <button
      className={`lesson-card ${lesson.color}`}
      onClick={() => navigate(`/luyen-viet/${lesson.id}`)}
    >
      <div className="lesson-art-wrap">
        <LessonArt kind={lesson.illustration} />
        <span className="lesson-time">
          <Icon name="clock" size={13} />
          {lesson.minutes} phút
        </span>
      </div>
      <div className="lesson-card-content">
        <div className="lesson-meta">
          <span>{typeLabels[lesson.item_type]}</span>
          <span>{lesson.items.length} nội dung</span>
        </div>
        <h3>{lesson.title}</h3>
        <p>{lesson.description}</p>
        <div className="lesson-card-bottom">
          <div className="lesson-progress">
            <div className="progress-track">
              <span
                style={{ width: `${(count / lesson.items.length) * 100}%` }}
              />
            </div>
            <small>
              {count
                ? `${count}/${lesson.items.length} đã luyện`
                : 'Sẵn sàng khám phá'}
            </small>
          </div>
          <span className="lesson-go">
            <Icon name="arrow" size={19} />
          </span>
        </div>
      </div>
    </button>
  )
}

function Catalogue({
  submissions,
  compact = false,
  grade,
  category,
  setCategory,
}: {
  submissions: Submission[]
  compact?: boolean
  grade: Grade | 'ALL'
  category: ItemType | 'ALL'
  setCategory: (category: ItemType | 'ALL') => void
}) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)
  const filtered = lessons.filter(
    (lesson) =>
      (grade === 'ALL' ||
        lesson.grade_level === grade ||
        (grade === 'LOP_1' &&
          ['LETTER', 'DIGIT'].includes(lesson.item_type))) &&
      (category === 'ALL' ||
        lesson.item_type === category ||
        (category === 'WORD' && lesson.item_type === 'SENTENCE')) &&
      lesson.title
        .toLocaleLowerCase('vi')
        .includes(search.toLocaleLowerCase('vi')),
  )
  return (
    <section className="catalogue-section">
      <div className="section-heading">
        <div>
          <h2>
            {compact
              ? 'Hôm nay mình học gì nhỉ?'
              : 'Một thế giới chữ đang chờ bé'}
          </h2>
          <p>
            {compact
              ? 'Chọn một bài học nhỏ, khám phá thật nhiều điều hay.'
              : 'Mỗi bài học là một khám phá. Bé thích bắt đầu từ đâu?'}
          </p>
        </div>
        {compact && (
          <NavLink to="/bai-hoc" className="text-button">
            Xem tất cả
            <Icon name="arrow" size={17} />
          </NavLink>
        )}
      </div>
      <div className="catalogue-controls">
        <div className="category-tabs" role="tablist" aria-label="Nhóm bài học">
          {categories.map((c) => (
            <button
              key={c.value}
              role="tab"
              aria-selected={category === c.value}
              className={category === c.value ? 'active' : ''}
              onClick={() => {
                setCategory(c.value)
                setShowAll(false)
              }}
            >
              <Icon name={c.icon} size={18} />
              {c.label}
            </button>
          ))}
        </div>
        {!compact && (
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bài học..."
              aria-label="Tìm bài học"
            />
          </label>
        )}
      </div>
      <div className="lesson-grid">
        {filtered
          .slice(0, compact && !showAll ? 3 : undefined)
          .map((lesson) => (
            <LessonCard
              key={lesson.id}
              lesson={lesson}
              submissions={submissions}
            />
          ))}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Icon name="book" size={38} />
          <h3>Chưa có bài học trong nhóm này</h3>
          <p>Bé thử chọn Lớp 1 để khám phá chữ ghép, từ và câu nhé.</p>
          <button
            className="soft-button"
            onClick={() => {
              setCategory('ALL')
              setSearch('')
            }}
          >
            Xem các bài học khác
          </button>
        </div>
      )}
      {compact && filtered.length > 3 && !showAll && (
        <button className="more-lessons" onClick={() => setShowAll(true)}>
          Khám phá thêm bài học
          <Icon name="down" size={17} />
        </button>
      )}
    </section>
  )
}

function Home({ profile, submissions }: PageProps) {
  const navigate = useNavigate()
  const [category, setCategory] = useState<ItemType | 'ALL'>('ALL')
  const [grade, setGrade] = useState<Grade>(profile.grade_level)
  const { todayCount, streak, practiced } = useSummary(submissions)
  const lastLesson = submissions.length
    ? (lessons.find((l) => l.id === submissions[0].lesson_id) ?? lessons[1])
    : lessons[1]
  return (
    <div className="page-enter">
      <div className="greeting-row">
        <div>
          <h1>
            Chào {profile.nickname}, mình cùng học nhé!{' '}
            <span className="greeting-sun">☀</span>
          </h1>
          <p>Một chút chăm chỉ mỗi ngày, ngàn nét chữ xinh tương lai.</p>
        </div>
        <label className="grade-select">
          <Icon name="book" size={18} />
          <select
            value={grade}
            onChange={(e) => setGrade(e.target.value as Grade)}
            aria-label="Chọn chương trình học"
          >
            <option value="MAU_GIAO">Mẫu giáo</option>
            <option value="LOP_1">Lớp 1</option>
          </select>
          <Icon name="down" size={14} />
        </label>
      </div>
      <section className="welcome-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow">
            <span /> NÉT CHỮ NHỎ, ƯỚC MƠ TO
          </div>
          <h2>
            Viết từng nét xinh,
            <br />
            <span>lớn thêm mỗi ngày.</span>
          </h2>
          <p>
            Cùng bạn cáo Pip khám phá thế giới chữ cái
            <br className="desktop-break" /> và những con số thật vui!
          </p>
          <button
            className="primary-button"
            onClick={() => navigate(`/luyen-viet/${lastLesson.id}`)}
          >
            Bắt đầu học nào
            <Icon name="arrow" size={19} />
          </button>
          <span className="hero-footnote">
            <Icon name="heart" size={14} /> Học vui, không áp lực
          </span>
        </div>
        <HeroArtwork />
      </section>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon coral">
            <Icon name="flame" size={26} />
          </div>
          <div>
            <strong>
              {streak}
              <span> ngày</span>
            </strong>
            <p>Chăm chỉ liên tiếp</p>
          </div>
          <span className="stat-decoration">✦</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon mint">
            <Icon name="book" size={26} />
          </div>
          <div>
            <strong>
              {practiced}
              <span> nội dung</span>
            </strong>
            <p>Bé đã luyện viết</p>
          </div>
          <span className="stat-decoration">↗</span>
        </div>
        <div className="stat-card">
          <div className="stat-icon sunny">
            <Icon name="star" size={27} />
          </div>
          <div>
            <strong>
              {submissions.length}
              <span> bài viết</span>
            </strong>
            <p>Những cố gắng của bé</p>
          </div>
          <span className="stat-decoration">✧</span>
        </div>
      </div>
      <div className="home-columns">
        <div className="home-main">
          <Catalogue
            compact
            submissions={submissions}
            grade={grade}
            category={category}
            setCategory={setCategory}
          />
          <section className="paper-banner">
            <div className="paper-icon">
              <Icon name="camera" size={29} />
            </div>
            <div>
              <h3>Trang vở nhỏ, tiến bộ to</h3>
              <p>Bé thích viết trên giấy? Chụp bài viết để lưu lại nhé.</p>
            </div>
            <button
              className="soft-button"
              onClick={() => navigate('/luyen-viet')}
            >
              Thử ngay
              <Icon name="arrow" size={17} />
            </button>
          </section>
        </div>
        <aside className="home-aside">
          <section className="daily-goal panel">
            <div className="small-heading">
              <h3>Mục tiêu hôm nay</h3>
              <Icon name="sun" size={21} />
            </div>
            <div
              className="goal-ring"
              style={
                {
                  '--progress': `${Math.min(todayCount / profile.daily_goal, 1) * 100}%`,
                } as React.CSSProperties
              }
            >
              <div>
                <span className="goal-star">★</span>
                <strong>
                  {todayCount}
                  <small>/{profile.daily_goal}</small>
                </strong>
                <span>bài luyện viết</span>
              </div>
            </div>
            <h4>
              {todayCount >= profile.daily_goal
                ? 'Bé đã làm được rồi!'
                : 'Từng chút một, bé làm được!'}
            </h4>
            <p>
              {todayCount >= profile.daily_goal
                ? 'Một ngày học thật vui. Nhớ nghỉ tay nhé!'
                : `Chỉ ${Math.max(profile.daily_goal - todayCount, 0)} bài nhỏ nữa để hoàn thành mục tiêu.`}
            </p>
            <div className="goal-dots">
              {Array.from({ length: profile.daily_goal }, (_, i) => (
                <span key={i} className={i < todayCount ? 'done' : ''}>
                  <Icon name={i < todayCount ? 'check' : 'star'} size={15} />
                </span>
              ))}
            </div>
          </section>
          <section className="pip-tip">
            <div>
              <span className="eyebrow">PIP THÌ THẦM</span>
              <h3>
                Đẹp từng nét,
                <br />
                vui từng ngày!
              </h3>
              <p>
                Bé nhớ nghỉ mắt và
                <br />
                vươn vai sau khi viết nhé.
              </p>
            </div>
            <Mascot className="tip-mascot" waving />
            <span className="tip-sparkle">✧</span>
          </section>
        </aside>
      </div>
      <div className="page-bottom">
        <span>
          <Icon name="heart" size={14} /> Mỗi em bé đều có nhịp học riêng. Cứ từ
          từ thôi nhé!
        </span>
        <span>
          Được làm với yêu thương <span className="tiny-heart">♥</span>
        </span>
      </div>
    </div>
  )
}

function LessonsPage({ profile, submissions }: PageProps) {
  const [category, setCategory] = useState<ItemType | 'ALL'>('ALL')
  const [grade, setGrade] = useState<Grade | 'ALL'>(profile.grade_level)
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">HỌC MỘT CHÚT, VUI THẬT NHIỀU</span>
          <h1>Bài học của bé</h1>
          <p>Từ nét bút đầu tiên đến những câu văn nhỏ.</p>
        </div>
        <label className="grade-select">
          <select
            value={grade}
            aria-label="Chọn cấp học"
            onChange={(e) => setGrade(e.target.value as Grade | 'ALL')}
          >
            <option value="ALL">Tất cả chương trình</option>
            <option value="MAU_GIAO">Mẫu giáo</option>
            <option value="LOP_1">Lớp 1</option>
          </select>
          <Icon name="down" size={15} />
        </label>
      </div>
      <Catalogue
        submissions={submissions}
        grade={grade}
        category={category}
        setCategory={setCategory}
      />
    </div>
  )
}

function FreePractice({ submissions }: { submissions: Submission[] }) {
  const [category, setCategory] = useState<ItemType | 'ALL'>('ALL')
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">TRANG GIẤY CỦA RIÊNG BÉ</span>
          <h1>Bé muốn viết gì hôm nay?</h1>
          <p>Chọn một nhóm chữ để viết trên màn hình hoặc chụp bài trong vở.</p>
        </div>
        <div className="title-illustration">
          <Icon name="pen" size={40} />
        </div>
      </div>
      <Catalogue
        submissions={submissions}
        grade="ALL"
        category={category}
        setCategory={setCategory}
      />
    </div>
  )
}

function Progress({
  profile,
  submissions,
  parent = false,
}: PageProps & { parent?: boolean }) {
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState<Submission | null>(null)
  const { practiced, streak } = useSummary(submissions)
  const filtered = submissions.filter(
    (s) => filter === 'ALL' || s.source === filter,
  )
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date()
    date.setDate(date.getDate() - 6 + i)
    return {
      label: date.toLocaleDateString('vi-VN', { weekday: 'short' }),
      count: submissions.filter(
        (s) => localDay(s.created_at) === localDay(date.toISOString()),
      ).length,
    }
  })
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {parent ? 'CÙNG CON LỚN KHÔN' : 'MỖI NGÀY MỘT CHÚT TIẾN BỘ'}
          </span>
          <h1>{parent ? 'Góc dành cho ba mẹ' : 'Hành trình của bé'}</h1>
          <p>
            {parent
              ? `Cùng dõi theo những cố gắng nhỏ của ${profile.nickname}.`
              : 'Mọi cố gắng của bé đều được trân trọng và lưu giữ.'}
          </p>
        </div>
        <span className="local-label">
          <span /> Dữ liệu trên thiết bị này
        </span>
      </div>
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-icon coral">
            <Icon name="pen" />
          </div>
          <div>
            <strong>{submissions.length}</strong>
            <p>Bài luyện viết đã lưu</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon mint">
            <Icon name="book" />
          </div>
          <div>
            <strong>{practiced}</strong>
            <p>Nội dung đã luyện</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon sunny">
            <Icon name="flame" />
          </div>
          <div>
            <strong>
              {streak}
              <span> ngày</span>
            </strong>
            <p>Chăm chỉ liên tiếp</p>
          </div>
        </div>
      </div>
      <div className="progress-overview">
        <section className="panel activity-panel">
          <div className="small-heading">
            <h3>Một tuần chăm chỉ</h3>
            <span>7 ngày gần nhất</span>
          </div>
          <div className="activity-chart">
            {days.map((day, i) => (
              <div className="activity-day" key={i}>
                <span>{day.count}</span>
                <div className="bar-area">
                  <div
                    className={i === 6 ? 'today-bar' : ''}
                    style={{
                      height: `${day.count ? Math.max(12, (day.count / Math.max(...days.map((d) => d.count), 1)) * 100) : 3}%`,
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
            Ba mẹ cùng con luyện tập 5–10 phút mỗi ngày. Một lời khen nhỏ sẽ
            giúp con tự tin hơn rất nhiều.
          </p>
          <span>
            Điểm AI và nhận xét chi tiết sẽ xuất hiện sau khi kết nối hệ thống
            chấm bài.
          </span>
        </section>
      </div>
      <section className="panel history-panel">
        <div className="small-heading">
          <h3>Những trang viết của bé</h3>
          <select
            value={filter}
            aria-label="Lọc bài viết theo nguồn"
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="ALL">Tất cả bài viết</option>
            <option value="TOUCH">Viết trên màn hình</option>
            <option value="CAMERA">Ảnh bài viết</option>
          </select>
        </div>
        {filtered.length ? (
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Bài viết</th>
                  <th>Cách luyện</th>
                  <th>Thời gian</th>
                  <th>Kết quả</th>
                  <th>
                    <span className="sr-only">Chi tiết</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.expected_text}</strong>
                      <small>
                        {lessons.find((l) => l.id === s.lesson_id)?.title}
                      </small>
                    </td>
                    <td>
                      <Icon
                        name={s.source === 'TOUCH' ? 'pen' : 'camera'}
                        size={16}
                      />{' '}
                      {s.source === 'TOUCH' ? 'Màn hình' : 'Chụp ảnh'}
                    </td>
                    <td>
                      {new Date(s.created_at).toLocaleString('vi-VN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td>
                      <span className="pending-status">Chờ AI nhận xét</span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Xem bài viết ${s.expected_text}`}
                        onClick={() => setSelected(s)}
                      >
                        <Icon name="chevron" size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="book" size={42} />
            <h3>
              {submissions.length
                ? 'Chưa có bài viết ở nhóm này'
                : 'Trang đầu tiên đang chờ bé'}
            </h3>
            <p>
              Bắt đầu một bài luyện viết, hành trình của bé sẽ xuất hiện ở đây.
            </p>
            <NavLink to="/bai-hoc" className="primary-button">
              Khám phá bài học
              <Icon name="arrow" size={18} />
            </NavLink>
          </div>
        )}
      </section>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Đóng chi tiết"
              onClick={() => setSelected(null)}
              autoFocus
            >
              <Icon name="close" />
            </button>
            <span className="eyebrow">BÀI VIẾT CỦA BÉ</span>
            <h2 id="detail-title">{selected.expected_text}</h2>
            {selected.stroke_data ? (
              <svg
                className="stroke-preview"
                viewBox="0 0 900 420"
                aria-label="Nét viết đã lưu"
              >
                {selected.stroke_data.map((stroke, i) => (
                  <polyline
                    key={i}
                    points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#7e57b4"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </svg>
            ) : (
              <p className="camera-history-note">
                Bài luyện bằng ảnh đã được ghi nhận. Ảnh chỉ được giữ trong
                phiên luyện viết, chưa lưu trên máy chủ.
              </p>
            )}
            <p>{selected.feedback_text}</p>
            <div className="score-placeholders">
              {['Hình dạng', 'Tương đồng', 'Hướng nét', 'Thứ tự nét'].map(
                (label) => (
                  <div key={label}>
                    <strong>—</strong>
                    <span>{label}</span>
                  </div>
                ),
              )}
            </div>
            <button className="soft-button" onClick={() => setSelected(null)}>
              Đóng
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

function Achievements({ submissions }: PageProps) {
  const practiced = new Set(submissions.map((s) => s.item_id)).size
  const awards = [
    {
      icon: 'leaf',
      title: 'Nét bút đầu tiên',
      detail: 'Lưu bài luyện viết đầu tiên',
      goal: 1,
      count: submissions.length,
      color: 'mint',
    },
    {
      icon: 'pen',
      title: 'Đôi tay chăm chỉ',
      detail: 'Luyện viết 5 nội dung khác nhau',
      goal: 5,
      count: practiced,
      color: 'coral',
    },
    {
      icon: 'book',
      title: 'Nhà thám hiểm chữ',
      detail: 'Luyện viết 10 nội dung khác nhau',
      goal: 10,
      count: practiced,
      color: 'sky',
    },
    {
      icon: 'star',
      title: 'Ngôi sao bền bỉ',
      detail: 'Lưu đủ 20 bài luyện viết',
      goal: 20,
      count: submissions.length,
      color: 'grape',
    },
  ]
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">GIEO CHĂM CHỈ, GẶT NIỀM VUI</span>
          <h1>Vườn thành tích của bé</h1>
          <p>Mỗi huy hiệu là một dấu mốc nho nhỏ trên hành trình của bé.</p>
        </div>
        <div className="title-illustration sunny">
          <Icon name="trophy" size={40} />
        </div>
      </div>
      <div className="achievement-banner">
        <Mascot waving />
        <div>
          <h2>
            {submissions.length
              ? 'Pip rất tự hào về bé!'
              : 'Cùng gieo những hạt giống đầu tiên!'}
          </h2>
          <p>Chỉ cần thử sức, bé đã tiến thêm một bước rồi.</p>
        </div>
      </div>
      <div className="award-grid">
        {awards.map((award) => (
          <section
            key={award.title}
            className={`award-card panel ${award.color} ${award.count >= award.goal ? 'earned' : ''}`}
          >
            <div className="award-medal">
              <Icon name={award.icon} size={46} />
              <span>✦</span>
            </div>
            <h3>{award.title}</h3>
            <p>{award.detail}</p>
            <div className="progress-track">
              <span
                style={{
                  width: `${Math.min((award.count / award.goal) * 100, 100)}%`,
                }}
              />
            </div>
            <small>
              {award.count >= award.goal
                ? 'Đã đạt được · Bé thật tuyệt!'
                : `${Math.min(award.count, award.goal)}/${award.goal} · Cùng cố gắng nhé`}
            </small>
          </section>
        ))}
      </div>
    </div>
  )
}

function Settings({
  profile,
  onUpdate,
}: {
  profile: Profile
  onUpdate: (profile: Profile) => void
}) {
  const [saved, setSaved] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    onUpdate({
      nickname: String(data.get('nickname')).trim().normalize('NFC'),
      grade_level: data.get('grade') as Grade,
      birth_year: Number(data.get('birth_year')),
      daily_goal: Number(data.get('goal')),
    })
    setSaved(true)
  }
  return (
    <div className="page-enter settings-page">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">THÊM MỘT CHÚT RIÊNG CHO BÉ</span>
          <h1>Hồ sơ & cài đặt</h1>
          <p>Ba mẹ thiết lập chương trình vừa sức với con nhé.</p>
        </div>
      </div>
      <form
        className="panel settings-form"
        onSubmit={submit}
        onChange={() => setSaved(false)}
      >
        <div className="profile-form-heading">
          <div className="avatar large">
            <Mascot />
          </div>
          <div>
            <h2>Người bạn nhỏ của Pip</h2>
            <p>Hồ sơ học tập trên thiết bị này</p>
          </div>
        </div>
        <label>
          Tên gọi của bé
          <input
            name="nickname"
            defaultValue={profile.nickname}
            minLength={1}
            maxLength={30}
            required
            pattern=".*\S.*"
            placeholder="Tên thật dễ thương của bé"
          />
        </label>
        <div className="form-grid">
          <label>
            Năm sinh
            <input
              type="number"
              name="birth_year"
              defaultValue={profile.birth_year}
              min={2008}
              max={new Date().getFullYear()}
              required
            />
          </label>
          <label>
            Chương trình học
            <select name="grade" defaultValue={profile.grade_level}>
              <option value="MAU_GIAO">Mẫu giáo</option>
              <option value="LOP_1">Lớp 1</option>
            </select>
          </label>
        </div>
        <label>
          Mục tiêu luyện viết mỗi ngày
          <select name="goal" defaultValue={profile.daily_goal}>
            <option value="3">3 bài nhỏ · Khởi đầu nhẹ nhàng</option>
            <option value="5">5 bài nhỏ · Chăm chỉ mỗi ngày</option>
            <option value="7">7 bài nhỏ · Thêm một chút thử thách</option>
          </select>
        </label>
        <div className="settings-save">
          <span role="status">
            {saved && (
              <>
                <Icon name="check" size={18} /> Đã lưu hồ sơ của bé
              </>
            )}
          </span>
          <button className="primary-button" type="submit">
            Lưu thay đổi
            <Icon name="check" size={18} />
          </button>
        </div>
      </form>
      <div className="settings-note">
        <Icon name="shield" size={22} />
        <p>
          Phiên bản giao diện lưu hồ sơ và lượt luyện tập trong trình duyệt hiện
          tại. Ba mẹ có thể trải nghiệm mà chưa cần tạo tài khoản.
        </p>
      </div>
    </div>
  )
}

function PracticeRoute({
  onSave,
  muted,
}: {
  onSave: (submission: Submission) => void
  muted: boolean
}) {
  const { lessonId } = useParams()
  const navigate = useNavigate()
  const lesson = lessons.find((l) => l.id === Number(lessonId))
  return lesson ? (
    <Practice
      key={lesson.id}
      lesson={lesson}
      onSave={onSave}
      muted={muted}
      onBack={() => navigate('/bai-hoc')}
    />
  ) : (
    <NotFound />
  )
}
function NotFound() {
  return (
    <div className="empty-state not-found">
      <Mascot />
      <h1>Pip chưa tìm thấy trang này</h1>
      <p>Mình quay về góc học tập nhé!</p>
      <NavLink to="/" className="primary-button">
        Về góc học tập
        <Icon name="arrow" size={18} />
      </NavLink>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  const [profile, setProfile, profileStorageError] = useLocalStorage<Profile>(
    'netxinh.profile.v1',
    {
      nickname: 'Bông',
      grade_level: 'MAU_GIAO',
      birth_year: 2021,
      daily_goal: 3,
    },
  )
  const [submissions, setSubmissions, submissionStorageError] = useLocalStorage<
    Submission[]
  >('netxinh.submissions.v1', [])
  const [muted, setMuted] = useLocalStorage('netxinh.muted.v1', false)
  const [motionPaused, setMotionPaused] = useLocalStorage(
    'netxinh.motion-paused.v1',
    false,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const pageProps = { profile, submissions }
  return (
    <div className={`app-shell ${motionPaused ? 'motion-paused' : ''}`}>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <NavLink to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">
            <Icon name="pen" size={25} />
            <span>✦</span>
          </span>
          <span>
            Nét<span className="brand-coral">Xinh</span>
            <small>BÉ VUI HỌC VIẾT</small>
          </span>
        </NavLink>
        <div className="sidebar-profile">
          <div className="avatar">
            <Mascot />
          </div>
          <div>
            <strong>Bé {profile.nickname}</strong>
            <span>
              {gradeLabels[profile.grade_level]}
              <span className="profile-dot" /> Khám phá viên
            </span>
          </div>
          <NavLink
            to="/cai-dat"
            aria-label="Sửa hồ sơ của bé"
            className="profile-edit"
          >
            <Icon name="down" size={15} />
          </NavLink>
        </div>
        <span className="nav-label">THẾ GIỚI CỦA BÉ</span>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
              {item.end && <span className="active-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <Mascot className="sidebar-mascot" />
          <span className="sidebar-note-sparkle">✦</span>
          <h3>
            Mỗi nét chữ,
            <br />
            một niềm vui!
          </h3>
          <p>
            Pip luôn ở đây
            <br />
            đồng hành cùng bé.
          </p>
          <button onClick={() => setHelpOpen(true)}>
            Làm quen với Pip
            <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <NavLink to="/phu-huynh" onClick={() => setMenuOpen(false)}>
            <Icon name="heart" size={20} /> Góc ba mẹ
            <Icon name="chevron" size={14} />
          </NavLink>
          <NavLink to="/cai-dat" onClick={() => setMenuOpen(false)}>
            <Icon name="settings" size={20} /> Cài đặt
          </NavLink>
          <div className="sidebar-footer">
            <span>NétXinh © 2026</span>
            <button
              aria-label={
                motionPaused ? 'Bật chuyển động' : 'Tạm dừng chuyển động'
              }
              onClick={() => setMotionPaused(!motionPaused)}
            >
              {motionPaused ? 'Bật chuyển động' : 'Dừng chuyển động'}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar-breadcrumb">
              Không gian học tập <Icon name="chevron" size={13} />
              <strong>Của riêng bé</strong>
            </span>
          </div>
          <div className="topbar-actions">
            <span className="kind-message">
              <span /> Mỗi ngày một chút tiến bộ
            </span>
            <button
              className="icon-button"
              aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              aria-pressed={muted}
              onClick={() => {
                setMuted(!muted)
                window.speechSynthesis?.cancel()
              }}
            >
              <Icon name={muted ? 'mute' : 'volume'} size={20} />
            </button>
            <div className="notification-wrap">
              <button
                className="icon-button"
                aria-label="Thông báo"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Icon name="bell" size={20} />
                <span className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover panel">
                  <h3>Một lời nhắn từ Pip</h3>
                  <p>
                    Chào bé đến với NétXinh! Chọn một bài học và thử viết nét
                    đầu tiên nhé.
                  </p>
                  <small>Chúc bé có một buổi học thật vui.</small>
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <NavLink
              to="/cai-dat"
              className="topbar-profile"
              aria-label="Mở hồ sơ"
            >
              <div className="avatar small">
                <Mascot />
              </div>
              <strong>Bé {profile.nickname}</strong>
              <Icon name="down" size={13} />
            </NavLink>
          </div>
        </header>
        <main id="main-content" className="main-content">
          {(profileStorageError || submissionStorageError) && (
            <div className="storage-alert" role="alert">
              Trình duyệt chưa lưu được dữ liệu. Bài viết hiện được giữ trong
              phiên này; bé có thể tải bài viết về để giữ lại nhé.
            </div>
          )}
          <Routes>
            <Route path="/" element={<Home {...pageProps} />} />
            <Route path="/bai-hoc" element={<LessonsPage {...pageProps} />} />
            <Route
              path="/luyen-viet"
              element={<FreePractice submissions={submissions} />}
            />
            <Route
              path="/luyen-viet/:lessonId"
              element={
                <PracticeRoute
                  muted={muted}
                  onSave={(s) => setSubmissions((previous) => [s, ...previous])}
                />
              }
            />
            <Route
              path="/thanh-tich"
              element={<Achievements {...pageProps} />}
            />
            <Route path="/tien-do" element={<Progress {...pageProps} />} />
            <Route
              path="/phu-huynh"
              element={<Progress {...pageProps} parent />}
            />
            <Route
              path="/cai-dat"
              element={<Settings profile={profile} onUpdate={setProfile} />}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
      {helpOpen && (
        <div className="modal-backdrop" onClick={() => setHelpOpen(false)}>
          <section
            className="modal help-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button modal-close"
              aria-label="Đóng hướng dẫn"
              onClick={() => setHelpOpen(false)}
              autoFocus
            >
              <Icon name="close" />
            </button>
            <Mascot waving />
            <h2 id="help-title">Chào bé, mình là Pip!</h2>
            <p>Mình sẽ đồng hành cùng bé trên hành trình viết chữ.</p>
            <ol>
              <li>
                <strong>Chọn bài học</strong> về chữ cái, chữ số hoặc từ và câu.
              </li>
              <li>
                <strong>Viết thật vui</strong> bằng chuột, ngón tay, bút cảm ứng
                hoặc chụp trang vở.
              </li>
              <li>
                <strong>Lưu cố gắng của bé</strong> và ghé thăm vườn thành tích
                nhé!
              </li>
            </ol>
            <button
              className="primary-button"
              onClick={() => setHelpOpen(false)}
            >
              Mình hiểu rồi, Pip ơi!
              <Icon name="heart" size={18} />
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}
