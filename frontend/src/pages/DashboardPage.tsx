import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useWorkspace } from '../context/workspace-context'
import { Icon } from '../components/Icons'
import { HeroArtwork, Mascot } from '../components/Artwork'
import { ErrorPanel, Loading } from '../components/Feedback'
import { LessonCard } from './LessonsPage'
import { DailyGoal } from '../components/DailyGoal'
import { TodayPlanSection } from '../components/TodayPlan'
import { useResource } from '../hooks/useResource'
import type { TodayPlan } from '../api/types'
import { gradeLabels } from '../data'

export function DashboardPage() {
  const { user } = useAuth(),
    { students, selected, lessons, overview } = useWorkspace()
  const today = useResource<TodayPlan>(
    selected ? `/students/${selected.id}/today` : null,
    `${selected?.id ?? ''}:${overview.data?.submissions ?? ''}`,
  )
  if (students.loading)
    return <Loading message="Đang chuẩn bị góc học tập của bé..." />
  if (students.error)
    return <ErrorPanel message={students.error} onRetry={students.reload} />
  if (!selected)
    return (
      <div className="page-enter">
        <div className="section-heading page-title">
          <div>
            <span className="eyebrow">
              CHÀO {user?.fullName?.toLocaleUpperCase('vi')}
            </span>
            <h1>Chào mừng gia đình đến NétXinh!</h1>
            <p>Một hành trình nhỏ, bắt đầu bằng thật nhiều yêu thương.</p>
          </div>
        </div>
        <section className="onboarding-empty panel">
          <Mascot waving />
          <div>
            <h2>Tạo góc học tập đầu tiên cho bé</h2>
            <p>
              Ba mẹ thêm biệt danh, năm sinh và cấp học. Pip sẽ chuẩn bị một thư
              viện bài học phù hợp với con.
            </p>
            <Link className="primary-button" to="/ho-so">
              Thêm hồ sơ bé
              <Icon name="arrow" size={19} />
            </Link>
          </div>
        </section>
        <section className="welcome-steps">
          <div>
            <span>01</span>
            <h3>Tạo hồ sơ</h3>
            <p>Mỗi bé một không gian riêng.</p>
          </div>
          <div>
            <span>02</span>
            <h3>Chọn bài học</h3>
            <p>Nội dung theo cấp của con.</p>
          </div>
          <div>
            <span>03</span>
            <h3>Cùng con khám phá</h3>
            <p>Từng chút một, thật vui mỗi ngày.</p>
          </div>
        </section>
      </div>
    )
  const recommended =
    lessons.data
      ?.filter((lesson) => lesson.gradeLevel === selected.gradeLevel)
      .slice(0, 3) ?? []
  return (
    <div className="page-enter">
      <div className="greeting-row">
        <div>
          <h1>
            Chào {selected.nickname}, mình cùng học nhé!{' '}
            <span className="greeting-sun">☀</span>
          </h1>
          <p>Một chút chăm chỉ mỗi ngày, ngàn nét chữ xinh tương lai.</p>
        </div>
        <Link to="/ho-so" className="grade-select">
          <Icon name="user" size={18} />
          {gradeLabels[selected.gradeLevel]}
          <Icon name="down" size={14} />
        </Link>
      </div>
      {today.data &&
        (today.data.dailyTarget != null || today.data.planItems.length > 0 ? (
          <div className="dashboard-today-stack">
            <DailyGoal today={today.data} nickname={selected.nickname} />
            <TodayPlanSection
              items={today.data.planItems}
              nickname={selected.nickname}
            />
          </div>
        ) : (
          <section className="panel today-invite-banner">
            <div className="today-invite-icon">
              <Icon name="calendar" size={24} />
            </div>
            <div>
              <strong>Ba mẹ đặt mục tiêu & kế hoạch cho {selected.nickname}</strong>
              <p>
                Đặt số bài mỗi ngày và chọn sẵn chữ/số để bé mở vào “Bài hôm nay”
                luyện ngay.
              </p>
            </div>
            <Link to="/ke-hoach" className="soft-button">
              Lập kế hoạch
              <Icon name="arrow" size={16} />
            </Link>
          </section>
        ))}
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
            Cùng bạn cáo Pip làm quen thế giới chữ cái
            <br className="desktop-break" /> và những con số thật vui!
          </p>
          <Link className="primary-button" to="/bai-hoc">
            Khám phá bài học
            <Icon name="arrow" size={19} />
          </Link>
          <span className="hero-footnote">
            <Icon name="heart" size={14} /> Học vui, không áp lực
          </span>
        </div>
        <HeroArtwork />
      </section>
      {overview.error ? (
        <ErrorPanel message={overview.error} onRetry={overview.reload} />
      ) : (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-icon mint">
              <Icon name="book" size={26} />
            </div>
            <div>
              <strong>
                {overview.loading ? '…' : (overview.data?.practicedItems ?? 0)}
              </strong>
              <p>Nội dung đã thực hành</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon coral">
              <Icon name="pen" size={26} />
            </div>
            <div>
              <strong>
                {overview.loading ? '…' : (overview.data?.submissions ?? 0)}
              </strong>
              <p>Bài viết trong hành trình</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon sunny">
              <Icon name="star" size={26} />
            </div>
            <div>
              <strong>
                {overview.loading ? '…' : (overview.data?.masteredItems ?? 0)}
              </strong>
              <p>Nội dung đã thuộc</p>
            </div>
          </div>
        </div>
      )}
      <div className="home-columns">
        <div className="home-main">
          <div className="section-heading">
            <div>
              <h2>Hôm nay mình khám phá gì nhỉ?</h2>
              <p>Những bài học dành cho {selected.nickname}.</p>
            </div>
            <Link to="/bai-hoc" className="text-button">
              Xem tất cả
              <Icon name="arrow" size={17} />
            </Link>
          </div>
          {lessons.loading ? (
            <Loading message="Đang tải bài học..." />
          ) : lessons.error ? (
            <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
          ) : (
            <div className="lesson-grid">
              {recommended.map((l) => (
                <LessonCard key={l.id} lesson={l} />
              ))}
            </div>
          )}
          <section className="paper-banner">
            <div className="paper-icon">
              <Icon name="user" size={28} />
            </div>
            <div>
              <h3>Học cùng anh chị em, vui gấp đôi</h3>
              <p>Ba mẹ có thể tạo hồ sơ riêng cho từng bé trong gia đình.</p>
            </div>
            <Link to="/ho-so" className="soft-button">
              Xem hồ sơ
              <Icon name="arrow" size={17} />
            </Link>
          </section>
        </div>
        <aside className="home-aside">
          <section className="panel family-card">
            <Icon name="heart" size={28} />
            <h3>Ba mẹ luôn ở bên</h3>
            <p>Ghé thăm hành trình để dõi theo những cố gắng của con.</p>
            <Link className="text-button" to="/phu-huynh">
              Xem hành trình
              <Icon name="arrow" size={17} />
            </Link>
          </section>
          <section className="pip-tip">
            <div>
              <span className="eyebrow">PIP THÌ THẦM</span>
              <h3>
                Từng chút một,
                <br />
                bé sẽ làm được!
              </h3>
              <p>
                Hôm nay mình làm quen
                <br />
                một chữ mới nhé.
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
      </div>
    </div>
  )
}
