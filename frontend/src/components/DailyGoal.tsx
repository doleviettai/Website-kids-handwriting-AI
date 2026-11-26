import { Link } from 'react-router-dom'
import type { TodayPlan } from '../api/types'
import { Mascot } from './Artwork'
import { Icon } from './Icons'

const CELEBRATIONS = [
  'Hoan hô! Hôm nay bé đã hoàn thành mục tiêu luyện viết rồi!',
  'Tuyệt vời quá! Pip tặng bé một tràng pháo tay thật to vì đã chăm chỉ hôm nay!',
  'Giỏi lắm luôn! Mỗi nét chữ hôm nay giúp bé lớn thêm một chút đấy!',
  'Chúc mừng bé đã về đích hôm nay! Mình nghỉ tay một chút rồi mai lại viết tiếp nhé!',
]

function celebrationFor(date: string, nickname: string) {
  let hash = 0
  const seed = `${date}:${nickname}`
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return CELEBRATIONS[Math.abs(hash) % CELEBRATIONS.length]
}

export function DailyGoal({
  today,
  nickname,
  compact = false,
}: {
  today: TodayPlan
  nickname: string
  compact?: boolean
}) {
  if (today.dailyTarget == null) return null
  const target = today.dailyTarget
  const done = today.doneToday
  const pct = Math.min(100, Math.round((done / target) * 100))

  return (
    <section
      className={`panel daily-goal-card ${today.goalReached ? 'is-reached' : ''} ${compact ? 'is-compact' : ''}`}
      aria-label="Mục tiêu luyện viết hôm nay"
    >
      <div className="daily-goal-head">
        <div>
          <span className="eyebrow">MỤC TIÊU HÔM NAY</span>
          <h3>
            {today.goalReached
              ? `Bé ${nickname} đã hoàn thành mục tiêu!`
              : `Hôm nay bé ${nickname} viết ${done}/${target} bài`}
          </h3>
        </div>
        {!compact && (
          <Link to="/ke-hoach" className="text-button">
            Đổi mục tiêu
            <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>

      <div
        className="goal-progress-track"
        role="progressbar"
        aria-label="Tiến độ mục tiêu luyện viết hôm nay"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(done, target)}
      >
        <div className="goal-progress-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="goal-progress-meta">
        <span>
          <strong>{done}</strong> / {target} bài hôm nay ({pct}%)
        </span>
        {!today.goalReached && (
          <span>Còn {Math.max(0, target - done)} bài nữa là về đích!</span>
        )}
      </div>

      {today.goalReached && (
        <div className="goal-celebration" role="status">
          <Mascot className="goal-celebration-mascot" waving />
          <div>
            <strong>✦ Chúc mừng bé {nickname}!</strong>
            <p>{celebrationFor(today.date, nickname)}</p>
          </div>
        </div>
      )}
    </section>
  )
}
