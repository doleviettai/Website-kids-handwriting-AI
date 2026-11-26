import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, apiError } from '../api/client'
import type {
  GoalResponse,
  PracticePlan,
  WritingItem,
} from '../api/types'
import type { ItemType } from '../types'
import { useWorkspace } from '../context/workspace-context'
import { useResource } from '../hooks/useResource'
import { typeLabels } from '../data'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteDialog } from '../components/DeleteDialog'
import { Mascot } from '../components/Artwork'
import { Icon } from '../components/Icons'

function todayIso() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysIso(iso: string, days: number) {
  const dt = new Date(`${iso}T00:00:00`)
  dt.setDate(dt.getDate() + days)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateVi(iso: string) {
  const parts = iso.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso
}

function planStatus(plan: PracticePlan, today: string) {
  if (today < plan.startDate) return { label: 'Sắp tới', cls: 'upcoming' }
  if (today > plan.endDate) return { label: 'Đã kết thúc', cls: 'ended' }
  return { label: 'Đang thực hiện', cls: 'active' }
}

type DraftItem = {
  item: WritingItem
  repetitions: number
}

export function PlanPage() {
  const { students, selected, lessons } = useWorkspace()
  const goal = useResource<GoalResponse>(
    selected ? `/students/${selected.id}/goal` : null,
    String(selected?.id ?? ''),
  )
  const plans = useResource<PracticePlan[]>(
    selected ? `/students/${selected.id}/plans` : null,
    String(selected?.id ?? ''),
  )

  const [targetDraft, setTargetDraft] = useState<number | null>(null)
  const [goalBusy, setGoalBusy] = useState(false)
  const [goalMsg, setGoalMsg] = useState('')
  const [goalError, setGoalError] = useState('')

  const [editing, setEditing] = useState<PracticePlan | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PracticePlan | null>(null)

  const allItems = useMemo(() => {
    const map = new Map<number, WritingItem>()
    for (const lesson of lessons.data ?? []) {
      for (const item of lesson.items) {
        map.set(item.id, item)
      }
    }
    return Array.from(map.values())
  }, [lessons.data])

  if (students.loading || lessons.loading) {
    return <Loading message="Đang tải kế hoạch luyện tập..." />
  }
  if (students.error || lessons.error) {
    return (
      <ErrorPanel
        message={students.error ?? lessons.error!}
        onRetry={() => {
          students.reload()
          lessons.reload()
        }}
      />
    )
  }
  if (!selected) {
    return (
      <div className="empty-state panel">
        <Mascot />
        <h2>Ba mẹ thêm hồ sơ bé trước nhé</h2>
        <p>Mỗi bé sẽ có mục tiêu hằng ngày và kế hoạch luyện viết riêng.</p>
        <Link to="/ho-so" className="primary-button">
          Tạo hồ sơ bé
          <Icon name="arrow" size={18} />
        </Link>
      </div>
    )
  }

  const currentTarget = targetDraft ?? goal.data?.dailyTarget ?? 5
  const today = todayIso()

  async function saveGoal() {
    if (!selected || goalBusy) return
    setGoalBusy(true)
    setGoalError('')
    setGoalMsg('')
    try {
      await api.put(`/students/${selected.id}/goal`, {
        dailyTarget: currentTarget,
      })
      setTargetDraft(null)
      goal.reload()
      setGoalMsg(`Đã lưu mục tiêu ${currentTarget} bài/ngày cho bé ${selected.nickname}.`)
    } catch (failure) {
      setGoalError(apiError(failure))
    } finally {
      setGoalBusy(false)
    }
  }

  async function removeGoal() {
    if (!selected || goalBusy) return
    setGoalBusy(true)
    setGoalError('')
    setGoalMsg('')
    try {
      await api.delete(`/students/${selected.id}/goal`)
      setTargetDraft(null)
      goal.reload()
      setGoalMsg(`Đã tắt mục tiêu hằng ngày của bé ${selected.nickname}.`)
    } catch (failure) {
      setGoalError(apiError(failure))
    } finally {
      setGoalBusy(false)
    }
  }

  return (
    <div className="page-enter">
      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            ĐỒNG HÀNH CÙNG BÉ {selected.nickname.toLocaleUpperCase('vi')}
          </span>
          <h1>Mục tiêu & Kế hoạch luyện tập</h1>
          <p>
            Đặt mục tiêu mỗi ngày và chọn sẵn chữ/số/từ để bé mở vào mục “Bài
            hôm nay” luyện ngay.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setEditing('new')}
        >
          Tạo kế hoạch mới
          <Icon name="calendar" size={18} />
        </button>
      </header>

      <section className="panel goal-editor-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">MỤC TIÊU HẰNG NGÀY</span>
            <h2>Số bài luyện viết mỗi ngày</h2>
            <p>
              {goal.data?.dailyTarget != null
                ? `Mục tiêu hiện tại: ${goal.data.dailyTarget} bài/ngày.`
                : 'Chưa đặt mục tiêu hằng ngày cho bé.'}
            </p>
          </div>
        </div>

        <div className="goal-editor-controls">
          <div className="goal-presets" aria-label="Gợi ý nhanh">
            {[3, 5, 10].map((preset) => (
              <button
                key={preset}
                type="button"
                className={
                  currentTarget === preset ? 'primary-button' : 'soft-button'
                }
                disabled={goalBusy}
                onClick={() => setTargetDraft(preset)}
              >
                {preset} bài/ngày
              </button>
            ))}
          </div>

          <div className="goal-stepper">
            <button
              type="button"
              className="icon-button"
              aria-label="Giảm mục tiêu"
              disabled={goalBusy || currentTarget <= 1}
              onClick={() => setTargetDraft(Math.max(1, currentTarget - 1))}
            >
              −
            </button>
            <strong>{currentTarget}</strong>
            <span>bài / ngày</span>
            <button
              type="button"
              className="icon-button"
              aria-label="Tăng mục tiêu"
              disabled={goalBusy || currentTarget >= 30}
              onClick={() => setTargetDraft(Math.min(30, currentTarget + 1))}
            >
              +
            </button>
          </div>

          <div className="goal-editor-actions">
            <button
              type="button"
              className="primary-button"
              disabled={goalBusy}
              onClick={() => void saveGoal()}
            >
              {goalBusy ? 'Đang lưu...' : 'Lưu mục tiêu'}
            </button>
            {goal.data?.dailyTarget != null && (
              <button
                type="button"
                className="text-button"
                disabled={goalBusy}
                onClick={() => void removeGoal()}
              >
                Tắt mục tiêu
              </button>
            )}
          </div>
        </div>

        {goalMsg && (
          <p role="status" className="form-success">
            {goalMsg}
          </p>
        )}
        {goalError && (
          <p role="alert" className="form-error">
            {goalError}
          </p>
        )}
      </section>

      <section className="plans-section">
        <div className="section-heading">
          <div>
            <h2>Kế hoạch luyện tập của {selected.nickname}</h2>
            <p>
              Các nội dung trong kế hoạch đang diễn ra sẽ hiển thị ở mục “Bài
              hôm nay” trên góc học tập.
            </p>
          </div>
        </div>

        {plans.loading ? (
          <Loading message="Đang tải danh sách kế hoạch..." />
        ) : plans.error ? (
          <ErrorPanel message={plans.error} onRetry={plans.reload} />
        ) : !plans.data?.length ? (
          <div className="empty-state panel">
            <Mascot />
            <h3>Chưa có kế hoạch nào</h3>
            <p>
              Ba mẹ chọn vài chữ cái hoặc con số bé cần rèn thêm để tạo kế hoạch
              đầu tiên nhé.
            </p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setEditing('new')}
            >
              Tạo kế hoạch đầu tiên
              <Icon name="arrow" size={17} />
            </button>
          </div>
        ) : (
          <div className="plans-list">
            {plans.data.map((plan) => {
              const status = planStatus(plan, today)
              return (
                <article key={plan.id} className="panel plan-card">
                  <div className="plan-card-head">
                    <div>
                      <span className={`plan-status-badge ${status.cls}`}>
                        {status.label}
                      </span>
                      <h3>{plan.title}</h3>
                      <p className="plan-dates">
                        <Icon name="calendar" size={15} />
                        {formatDateVi(plan.startDate)} –{' '}
                        {formatDateVi(plan.endDate)}
                      </p>
                    </div>
                    <div className="plan-card-actions">
                      <button
                        type="button"
                        className="soft-button"
                        onClick={() => setEditing(plan)}
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        type="button"
                        className="text-button danger-text"
                        onClick={() => setDeleting(plan)}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                  <div className="plan-items-summary">
                    {plan.items.map((item) => (
                      <span key={item.itemId} className="plan-item-tag">
                        <strong>{item.textValue}</strong> ×{item.repetitions}
                        <small>/ngày</small>
                      </span>
                    ))}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {editing && (
        <PlanEditorModal
          studentId={selected.id}
          initial={editing === 'new' ? null : editing}
          allItems={allItems}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            plans.reload()
          }}
        />
      )}

      {deleting && (
        <DeleteDialog
          title="Xóa kế hoạch luyện tập?"
          description={`Xóa kế hoạch "${deleting.title}" của bé ${selected.nickname}? Lịch sử bài viết đã lưu của bé không bị ảnh hưởng.`}
          url={`/students/${selected.id}/plans/${deleting.id}`}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            plans.reload()
          }}
        />
      )}
    </div>
  )
}

function PlanEditorModal({
  studentId,
  initial,
  allItems,
  onClose,
  onSaved,
}: {
  studentId: number
  initial: PracticePlan | null
  allItems: WritingItem[]
  onClose: () => void
  onSaved: () => void
}) {
  const defaultStart = todayIso()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [startDate, setStartDate] = useState(
    initial?.startDate ?? defaultStart,
  )
  const [endDate, setEndDate] = useState(
    initial?.endDate ?? addDaysIso(defaultStart, 6),
  )
  const [picked, setPicked] = useState<DraftItem[]>(() => {
    if (!initial) return []
    const byId = new Map(allItems.map((i) => [i.id, i]))
    return initial.items
      .map((pi) => {
        const found = byId.get(pi.itemId)
        return found ? { item: found, repetitions: pi.repetitions } : null
      })
      .filter((x): x is DraftItem => x !== null)
  })
  const [typeFilter, setTypeFilter] = useState<ItemType | 'ALL'>('ALL')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickedIds = useMemo(
    () => new Set(picked.map((p) => p.item.id)),
    [picked],
  )

  const filteredItems = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('vi')
    return allItems.filter((item) => {
      if (typeFilter !== 'ALL' && item.itemType !== typeFilter) return false
      if (q && !item.textValue.toLocaleLowerCase('vi').includes(q)) return false
      return true
    })
  }, [allItems, typeFilter, query])

  function toggleItem(item: WritingItem) {
    setPicked((prev) => {
      if (prev.some((p) => p.item.id === item.id)) {
        return prev.filter((p) => p.item.id !== item.id)
      }
      if (prev.length >= 30) return prev
      return [...prev, { item, repetitions: 2 }]
    })
  }

  function updateReps(itemId: number, delta: number) {
    setPicked((prev) =>
      prev.map((p) =>
        p.item.id === itemId
          ? {
              ...p,
              repetitions: Math.max(1, Math.min(10, p.repetitions + delta)),
            }
          : p,
      ),
    )
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!title.trim()) {
      setError('Ba mẹ đặt tên cho kế hoạch nhé.')
      return
    }
    if (picked.length === 0) {
      setError('Ba mẹ chọn ít nhất một nội dung luyện tập nhé.')
      return
    }
    setBusy(true)
    setError('')
    const body = {
      title: title.trim(),
      startDate,
      endDate,
      items: picked.map((p) => ({
        itemId: p.item.id,
        repetitions: p.repetitions,
      })),
    }
    try {
      if (initial) {
        await api.put(`/students/${studentId}/plans/${initial.id}`, body)
      } else {
        await api.post(`/students/${studentId}/plans`, body)
      }
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={initial ? 'Chỉnh sửa kế hoạch luyện tập' : 'Tạo kế hoạch luyện tập'}
      busy={busy}
      onClose={onClose}
    >
      <form className="plan-form" onSubmit={(e) => void submit(e)}>
        <label className="field">
          <span>Tên kế hoạch</span>
          <input
            type="text"
            maxLength={100}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Tuần luyện chữ a, ă, â"
          />
        </label>

        <div className="plan-date-row">
          <label className="field">
            <span>Từ ngày</span>
            <input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Đến ngày (tối đa 31 ngày)</span>
            <input
              type="date"
              required
              min={startDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
        </div>

        <div className="plan-picker-section">
          <div className="plan-picker-head">
            <strong>Nội dung đã chọn ({picked.length}/30)</strong>
          </div>
          {picked.length === 0 ? (
            <p className="empty-inline-note">
              Chọn các chữ, số hoặc từ bên dưới để thêm vào kế hoạch.
            </p>
          ) : (
            <ul className="plan-picked-list">
              {picked.map((p) => (
                <li key={p.item.id} className="plan-picked-row">
                  <span className="plan-picked-name">
                    <strong>{p.item.textValue}</strong>
                    <small>{typeLabels[p.item.itemType]}</small>
                  </span>
                  <div className="plan-rep-controls">
                    <button
                      type="button"
                      className="icon-button small"
                      aria-label={`Giảm số lượt cho ${p.item.textValue}`}
                      onClick={() => updateReps(p.item.id, -1)}
                      disabled={p.repetitions <= 1}
                    >
                      −
                    </button>
                    <span>{p.repetitions} lượt/ngày</span>
                    <button
                      type="button"
                      className="icon-button small"
                      aria-label={`Tăng số lượt cho ${p.item.textValue}`}
                      onClick={() => updateReps(p.item.id, 1)}
                      disabled={p.repetitions >= 10}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="text-button danger-text"
                      onClick={() => toggleItem(p.item)}
                    >
                      Bỏ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="plan-library-controls">
            <select
              aria-label="Lọc loại nội dung"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as ItemType | 'ALL')
              }
            >
              <option value="ALL">Tất cả loại</option>
              {(Object.keys(typeLabels) as ItemType[]).map((key) => (
                <option key={key} value={key}>
                  {typeLabels[key]}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm chữ, số, từ..."
            />
          </div>

          <div className="plan-library-grid">
            {filteredItems.map((item) => {
              const selectedItem = pickedIds.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`plan-library-chip ${selectedItem ? 'is-selected' : ''}`}
                  onClick={() => toggleItem(item)}
                >
                  <span>{item.textValue}</span>
                  {selectedItem && <Icon name="check" size={14} />}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}

        <div className="dialog-actions">
          <button
            type="button"
            className="soft-button"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </button>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : initial ? 'Lưu thay đổi' : 'Tạo kế hoạch'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
