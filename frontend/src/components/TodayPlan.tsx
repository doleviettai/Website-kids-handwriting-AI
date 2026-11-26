import { Link } from 'react-router-dom'
import type { TodayItem } from '../api/types'
import { typeLabels } from '../data'
import { practiceLinkForToday } from '../utils/practiceLinks'
import { Icon } from './Icons'

export function TodayPlanSection({
  items,
  nickname,
}: {
  items: TodayItem[]
  nickname: string
}) {
  if (!items.length) return null
  const completedCount = items.filter((i) => i.doneToday >= i.repetitions).length

  return (
    <section className="panel today-plan-card" aria-label="Bài hôm nay">
      <div className="today-plan-head">
        <div>
          <span className="eyebrow">KẾ HOẠCH CỦA BA MẸ</span>
          <h2>Bài hôm nay cho {nickname}</h2>
          <p>
            Đã xong {completedCount}/{items.length} nội dung. Chọn một thẻ để mở
            khung viết ngay nhé!
          </p>
        </div>
        <Link to="/ke-hoach" className="text-button">
          Quản lý kế hoạch
          <Icon name="arrow" size={16} />
        </Link>
      </div>

      <div className="today-items-grid">
        {items.map((item) => {
          const done = item.doneToday >= item.repetitions
          return (
            <div
              key={item.itemId}
              className={`today-item-tile ${done ? 'is-done' : ''}`}
            >
              <div className="today-item-top">
                <span className="today-item-type">
                  {typeLabels[item.itemType]}
                </span>
                <span className={`today-item-count ${done ? 'is-done' : ''}`}>
                  {done && <Icon name="check" size={14} />}
                  {item.doneToday}/{item.repetitions} lượt
                </span>
              </div>
              <strong className="today-item-text">{item.textValue}</strong>
              <Link
                to={practiceLinkForToday(item)}
                className={done ? 'soft-button' : 'primary-button'}
              >
                {done ? 'Luyện thêm' : 'Luyện ngay'}
                <Icon name="pen" size={16} />
              </Link>
            </div>
          )
        })}
      </div>
    </section>
  )
}
