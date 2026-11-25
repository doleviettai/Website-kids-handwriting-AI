import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { ApiLesson } from '../api/types'
import type { Grade, ItemType } from '../types'
import { categories, gradeLabels, typeLabels } from '../data'
import { useWorkspace } from '../context/workspace-context'
import { Icon } from '../components/Icons'
import { LessonArt } from '../components/Artwork'
import { ErrorPanel, Loading } from '../components/Feedback'
import { useAuth } from '../context/auth-context'

function lessonStyle(lesson: ApiLesson) {
  const type = lesson.items[0]?.itemType ?? 'LETTER'
  return (
    {
      LETTER: {
        color: 'coral',
        art: lesson.sortOrder === 1 ? 'strokes' : 'letters',
        text: 'Khám phá hình dáng và những nét chữ tiếng Việt.',
      },
      DIGIT: {
        color: 'sky',
        art: 'numbers',
        text: 'Làm quen với những con số qua từng bài học nhỏ.',
      },
      DIGRAPH: {
        color: 'grape',
        art: 'compound',
        text: 'Cùng tìm hiểu những chữ ghép quen thuộc.',
      },
      WORD: {
        color: 'mint',
        art: 'words',
        text: 'Khám phá từ ngữ gần gũi trong cuộc sống.',
      },
      SENTENCE: {
        color: 'sunny',
        art: 'sentence',
        text: 'Những câu văn nhỏ kể bao điều thân thương.',
      },
    } as const
  )[type]
}

export function LessonCard({ lesson }: { lesson: ApiLesson }) {
  const { overview } = useWorkspace(),
    visual = lessonStyle(lesson)
  const learned = lesson.items.filter((item) =>
    overview.data?.progress.some((p) => p.itemId === item.id && p.attempts > 0),
  ).length
  return (
    <Link
      to={`/bai-hoc/${lesson.id}`}
      className={`lesson-card ${visual.color}`}
    >
      <div className="lesson-art-wrap">
        <LessonArt kind={visual.art} />
        <span className="lesson-time">
          <Icon name="book" size={13} />
          {gradeLabels[lesson.gradeLevel]}
        </span>
      </div>
      <div className="lesson-card-content">
        <div className="lesson-meta">
          <span>
            {lesson.items[0]
              ? typeLabels[lesson.items[0].itemType]
              : 'Bài học mới'}
          </span>
          <span>{lesson.items.length} nội dung</span>
        </div>
        <h3>{lesson.title}</h3>
        <p>{visual.text}</p>
        <div className="lesson-card-bottom">
          <div className="lesson-progress">
            <div className="progress-track">
              <span
                style={{
                  width: `${lesson.items.length ? (learned / lesson.items.length) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {learned
                ? `${learned}/${lesson.items.length} đã luyện`
                : 'Khám phá nội dung bài học'}
            </small>
          </div>
          <span className="lesson-go">
            <Icon name="arrow" size={19} />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function LessonsPage() {
  const { lessons, selected } = useWorkspace()
  const [query, setQuery] = useSearchParams()
  const grade = ['MAU_GIAO', 'LOP_1', 'ALL'].includes(query.get('grade') ?? '')
    ? (query.get('grade') as Grade | 'ALL')
    : (selected?.gradeLevel ?? 'ALL')
  const category = categories.some((c) => c.value === query.get('type'))
    ? (query.get('type') as ItemType | 'ALL')
    : 'ALL'
  const search = query.get('q') ?? ''
  function update(key: string, value: string) {
    const next = new URLSearchParams(query)
    if (value) next.set(key, value)
    else next.delete(key)
    setQuery(next, { replace: true })
  }
  const rows =
    lessons.data?.filter(
      (l) =>
        (grade === 'ALL' ||
          l.gradeLevel === grade ||
          (grade === 'LOP_1' && l.gradeLevel === 'MAU_GIAO')) &&
        (category === 'ALL' ||
          l.items.some(
            (item) =>
              item.itemType === category ||
              (category === 'WORD' && item.itemType === 'SENTENCE'),
          )) &&
        l.title
          .toLocaleLowerCase('vi')
          .includes(search.trim().toLocaleLowerCase('vi')),
    ) ?? []
  return (
    <div className="page-enter">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">HỌC MỘT CHÚT, VUI THẬT NHIỀU</span>
          <h1>Bài học của {selected ? selected.nickname : 'bé'}</h1>
          <p>Từ những nét bút đầu tiên đến câu văn thân thương.</p>
        </div>
        <label className="grade-select">
          <Icon name="book" size={18} />
          <select
            value={grade}
            onChange={(e) => update('grade', e.target.value)}
            aria-label="Lọc theo cấp học"
          >
            <option value="ALL">Tất cả cấp học</option>
            <option value="MAU_GIAO">Mẫu giáo</option>
            <option value="LOP_1">Lớp 1 và bài nền tảng</option>
          </select>
          <Icon name="down" size={14} />
        </label>
      </div>
      <div className="catalogue-controls">
        <div className="category-tabs" aria-label="Lọc nhóm bài học">
          {categories.map((c) => (
            <button
              key={c.value}
              className={category === c.value ? 'active' : ''}
              aria-pressed={category === c.value}
              onClick={() => update('type', c.value)}
            >
              <Icon name={c.icon} size={18} />
              {c.label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Icon name="search" size={18} />
          <input
            aria-label="Tìm bài học"
            value={search}
            onChange={(e) => update('q', e.target.value)}
            placeholder="Tìm bài học..."
          />
        </label>
      </div>
      {lessons.loading ? (
        <Loading message="Đang tải thư viện bài học..." />
      ) : lessons.error ? (
        <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
      ) : (
        <>
          <p className="catalogue-count">
            {rows.length} bài học đang chờ bé khám phá
          </p>
          <div className="lesson-grid connected-lessons">
            {rows.map((l) => (
              <LessonCard key={l.id} lesson={l} />
            ))}
          </div>
          {!rows.length && (
            <div className="empty-state panel">
              <Icon name="search" size={40} />
              <h3>Chưa tìm thấy bài học phù hợp</h3>
              <p>Ba mẹ thử đổi từ khóa hoặc chọn một nhóm khác nhé.</p>
              <button
                className="soft-button"
                onClick={() => setQuery({ grade: 'ALL' })}
              >
                Xem tất cả bài học
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function LessonDetailPage() {
  const { user } = useAuth()
  const { lessonId } = useParams(),
    { lessons, overview } = useWorkspace()
  const lesson = lessons.data?.find((l) => l.id === Number(lessonId))
  const [active, setActive] = useState<number | null>(null)
  if (lessons.loading) return <Loading message="Đang mở bài học..." />
  if (lessons.error)
    return <ErrorPanel message={lessons.error} onRetry={lessons.reload} />
  if (!lesson)
    return (
      <div className="empty-state">
        <Icon name="book" size={40} />
        <h2>Chưa tìm thấy bài học</h2>
        <Link className="soft-button" to="/bai-hoc">
          Về danh sách bài học
        </Link>
      </div>
    )
  const item = lesson.items.find((row) => row.id === active) ?? lesson.items[0]
  return (
    <div className="page-enter">
      <Link className="back-link" to="/bai-hoc">
        <Icon name="arrow" className="rotate-back" size={18} /> Quay lại thư
        viện
      </Link>
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">
            {gradeLabels[lesson.gradeLevel].toUpperCase()} ·{' '}
            {lesson.items.length} NỘI DUNG
          </span>
          <h1>{lesson.title}</h1>
          <p>Chọn một chữ hoặc con số để cùng khám phá nhé!</p>
        </div>
      </div>
      <div className="lesson-detail-layout">
        <section className="panel item-library">
          <div className="small-heading">
            <h3>Nội dung trong bài</h3>
            <Icon name="book" size={20} />
          </div>
          <div className="library-items">
            {lesson.items.map((row) => {
              const p = overview.data?.progress.find((p) => p.itemId === row.id)
              return (
                <button
                  key={row.id}
                  className={item?.id === row.id ? 'active' : ''}
                  aria-pressed={item?.id === row.id}
                  onClick={() => setActive(row.id)}
                >
                  <strong>{row.textValue}</strong>
                  <span>
                    {p?.mastered
                      ? 'Đã thuộc'
                      : p?.attempts
                        ? 'Đang học'
                        : 'Chưa học'}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <section className="panel item-preview">
          {item ? (
            <>
              <span className="eyebrow">
                {typeLabels[item.itemType].toUpperCase()}
              </span>
              <div
                className={`preview-text ${item.textValue.length > 4 ? 'long' : ''}`}
              >
                {item.textValue}
              </div>
              <div className="preview-info">
                <span>Độ khó {item.difficulty ?? 1}/3</span>
                <span>
                  {item.template
                    ? 'Có mẫu nét tham khảo'
                    : 'Đang chuẩn bị mẫu nét'}
                </span>
              </div>
              {item.template && (
                <svg
                  className="reference-template"
                  viewBox={`0 0 ${item.template.width} ${item.template.height}`}
                  aria-label={`Mẫu nét tham khảo ${item.textValue}`}
                >
                  {item.template.strokes.map((stroke, i) =>
                    stroke.length === 1 ? (
                      <circle
                        key={i}
                        cx={stroke[0].x}
                        cy={stroke[0].y}
                        r={3.5}
                        fill="#a58bbd"
                      />
                    ) : (
                      <polyline
                        key={i}
                        points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#a58bbd"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ),
                  )}
                </svg>
              )}
              {user?.role === 'PARENT' && (
                <Link
                  className="primary-button"
                  to={`/luyen-viet/${lesson.id}?item=${item.id}`}
                >
                  Bé bắt đầu luyện viết
                  <Icon name="pen" size={18} />
                </Link>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h3>Bài học đang chờ thêm nội dung</h3>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
