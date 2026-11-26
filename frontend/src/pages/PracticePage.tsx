import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  AiStatus,
  Recognition,
  SubmissionDetail,
  TodayPlan,
  WritingItem,
  WritingTemplate,
} from '../api/types'
import { api, apiError } from '../api/client'
import { useWorkspace } from '../context/workspace-context'
import { useNotificationContext } from '../context/notification-context'
import { useResource } from '../hooks/useResource'
import { useRecognition } from '../hooks/useRecognition'
import { modelTaskFor } from '../types'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { SubmissionResult } from '../components/SubmissionResult'
import { RecognitionPreview } from '../components/RecognitionPreview'
import { DailyGoal } from '../components/DailyGoal'
import { practiceLinkForToday } from '../utils/practiceLinks'
import { ErrorPanel, Loading } from '../components/Feedback'
import { Icon } from '../components/Icons'

const MODES = [
  {
    task: 'SINGLE_CHAR',
    title: 'Chữ đơn & số',
    icon: 'letter',
    slug: 'chu-don',
  },
  { task: 'COMPOUND', title: 'Chữ ghép', icon: 'layers', slug: 'chu-ghep' },
  {
    task: 'PARAGRAPH',
    title: 'Từ, câu & đoạn',
    icon: 'book',
    slug: 'doan-van',
  },
]
type Exercise = { lessonId: number; item: WritingItem }
type SessionProps = Exercise & {
  studentId: number
  nickname: string
  ready: boolean
  choices: Exercise[]
  fromToday: boolean
  today: TodayPlan | null
  reloadToday: () => void
}

export function PracticePage() {
  const navigate = useNavigate()
  const { lessonId, practiceKind } = useParams(),
    [query] = useSearchParams()
  const { lessons, students, selected } = useWorkspace(),
    status = useResource<AiStatus>('/ai/status'),
    today = useResource<TodayPlan>(
      selected ? `/students/${selected.id}/today` : null,
      String(selected?.id ?? ''),
    )
  if (students.loading || lessons.loading) return <Loading />
  if (students.error || lessons.error)
    return (
      <ErrorPanel
        message={students.error ?? lessons.error!}
        onRetry={() => {
          students.reload()
          lessons.reload()
        }}
      />
    )
  if (!selected)
    return (
      <div className="empty-state panel">
        <h2>Ba mẹ chọn hồ sơ bé trước nhé</h2>
        <Link to="/ho-so" className="primary-button">
          Chọn hồ sơ bé
        </Link>
      </div>
    )
  const all = (lessons.data ?? []).flatMap((l) =>
    l.items.map((item) => ({ lessonId: l.id, item })),
  )
  const requested = MODES.find((m) => m.slug === practiceKind)
  const lessonChoices = all.filter((e) => e.lessonId === Number(lessonId))
  const exercise = practiceKind
    ? (all.find(
        (e) =>
          modelTaskFor(e.item.itemType) === requested?.task &&
          e.item.id === Number(query.get('item')),
      ) ?? all.find((e) => modelTaskFor(e.item.itemType) === requested?.task))
    : (lessonChoices.find((e) => e.item.id === Number(query.get('item'))) ??
      lessonChoices[0])
  if (!exercise)
    return (
      <div className="empty-state">
        <h2>Chưa có nội dung luyện viết</h2>
        <Link to="/bai-hoc" className="soft-button">
          Về thư viện
        </Link>
      </div>
    )
  const task = modelTaskFor(exercise.item.itemType),
    mode = MODES.find((m) => m.task === task)!,
    ready = status.data?.models[task]?.ready === true
  const props: SessionProps = {
    ...exercise,
    studentId: selected.id,
    nickname: selected.nickname,
    ready,
    choices: all.filter((e) => modelTaskFor(e.item.itemType) === task),
    fromToday: query.get('from') === 'today',
    today: today.data,
    reloadToday: today.reload,
  }
  return (
    <div className="page-enter practice-connected">
      <nav className="practice-mode-nav" aria-label="Chế độ luyện viết">
        {MODES.map((m) => (
          <Link
            key={m.task}
            to={`/luyen-tap/${m.slug}`}
            aria-current={task === m.task ? 'page' : undefined}
          >
            <Icon name={m.icon} size={19} />
            {m.title}
          </Link>
        ))}
      </nav>
      <div className="practice-mode-heading">
        <span className="eyebrow">
          {mode.title.toLocaleUpperCase('vi')} · BÉ{' '}
          {selected.nickname.toLocaleUpperCase('vi')}
        </span>
        <label>
          Nội dung luyện
          <select
            aria-label="Chọn nội dung luyện"
            value={exercise.item.id}
            onChange={(event) => {
              const next = props.choices.find(
                (e) => e.item.id === Number(event.target.value),
              )
              if (next) navigate(`/luyen-tap/${mode.slug}?item=${next.item.id}`)
            }}
          >
            {props.choices.map((e) => (
              <option key={e.item.id} value={e.item.id}>
                {e.item.textValue}
              </option>
            ))}
          </select>
        </label>
      </div>
      {status.loading ? (
        <Loading message="Đang kiểm tra model..." />
      ) : (
        !ready && (
          <ErrorPanel
            message={
              status.error ??
              status.data?.message ??
              status.data?.models[task]?.message ??
              'Model chưa sẵn sàng. Ba mẹ kiểm tra FastAPI nhé.'
            }
            onRetry={status.reload}
          />
        )
      )}{' '}
      {task === 'PARAGRAPH' ? (
        <PassageSession key={`${selected.id}:${exercise.item.id}`} {...props} />
      ) : (
        <GlyphSession
          key={`${selected.id}:${exercise.item.id}`}
          {...props}
          compound={task === 'COMPOUND'}
        />
      )}
    </div>
  )
}

function useSavedSubmission(props: SessionProps) {
  const { overview } = useWorkspace()
  const { refresh: refreshNotifications } = useNotificationContext()
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [result, setResult] = useState<SubmissionDetail | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function save(groups: WritingTemplate[], sequential: boolean) {
    if (busy || !groups.length || !props.ready) return
    const strokes = groups.flatMap((g) => g.strokes)
    if (
      strokes.length > 100 ||
      strokes.reduce((n, s) => n + s.length, 0) > 20000
    ) {
      setError('Bài hơi dài. Bé chia thành bài ngắn hơn nhé.')
      return
    }
    setBusy(true)
    setError('')
    let count = 0
    try {
      const response = await api.post<SubmissionDetail>(
        '/submissions',
        {
          studentId: props.studentId,
          itemId: props.item.id,
          width: groups[0].width,
          height: groups[0].height,
          strokes,
          wordEnds: sequential
            ? groups.map((g) => {
                count += g.strokes.length
                return count
              })
            : [],
        },
        { timeout: 110000 },
      )
      if (mounted.current) {
        setResult(response.data)
        overview.reload()
        props.reloadToday()
        refreshNotifications()
      }
    } catch (failure) {
      if (mounted.current) setError(apiError(failure))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  return {
    busy,
    error,
    result,
    save,
    reset: () => {
      setResult(null)
      setError('')
    },
  }
}

function GlyphSession(props: SessionProps & { compound: boolean }) {
  const [drawing, setDrawing] = useState<WritingTemplate | null>(null),
    [active, setActive] = useState(false)
  const recognition = useRecognition(
    props.studentId,
    props.item.id,
    drawing,
    active,
    props.ready,
  )
  const saved = useSavedSubmission(props)
  const locked = saved.busy || !!saved.result
  return (
    <>
      <header className="section-heading page-title">
        <div>
          <h1>
            {props.compound ? 'Viết một chữ ghép' : 'Viết một chữ hoặc số'}
          </h1>
          <p>
            {props.compound
              ? 'Viết cả cụm chữ liền nhau trong khung ngang, rồi nhận dạng thử.'
              : 'Viết trong khung vuông: thân chữ theo dòng kẻ, thêm dấu sau cùng.'}
          </p>
        </div>
        <Link to={`/bai-hoc/${props.lessonId}`} className="text-button">
          Về bài học
          <Icon name="arrow" size={17} />
        </Link>
      </header>
      <div
        className={`glyph-practice-layout ${props.compound ? 'compound-layout' : ''}`}
      >
        <section className="panel practice-workspace">
          <div className="exercise-target">
            <span>Nội dung cần viết</span>
            <strong>{props.item.textValue}</strong>
          </div>
          <DrawingCanvas
            value={drawing}
            onChange={setDrawing}
            disabled={locked}
            guide={props.item.textValue}
            mode="practice"
            layout={props.compound ? 'wide' : 'single'}
            onActivityChange={setActive}
          />
          <div className="recognition-controls">
            <button
              className="soft-button"
              disabled={
                locked ||
                active ||
                !drawing ||
                !props.ready ||
                recognition.loading
              }
              onClick={() => void recognition.run()}
            >
              Nhận dạng thử
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recognition.automatic}
                onChange={(e) => recognition.setAutomatic(e.target.checked)}
              />{' '}
              Tự đọc sau khi nhấc bút
            </label>
          </div>
          <div className="practice-submit-actions">
            <button
              className="primary-button"
              disabled={locked || active || !drawing || !props.ready}
              onClick={() => {
                if (drawing) void saved.save([drawing], false)
              }}
            >
              {saved.busy ? 'Đang nhận dạng & lưu...' : 'Gửi bài để nhận xét'}
              <Icon name="check" size={18} />
            </button>
            {saved.result && (
              <button
                className="soft-button"
                onClick={() => {
                  saved.reset()
                  setDrawing(null)
                }}
              >
                Bài viết mới
              </button>
            )}
          </div>
          {saved.error && (
            <p role="alert" className="form-error">
              {saved.error}
            </p>
          )}
        </section>
        <aside>
          <RecognitionPreview
            data={recognition.data}
            loading={recognition.loading}
            error={recognition.error}
            compound={props.compound}
          />
          <p className="assessment-note">
            Nhận dạng thử chỉ để xem máy đọc, chưa tính lượt học. Bấm “Gửi bài
            để nhận xét” khi bé đã hoàn thành.
          </p>
        </aside>
      </div>
      {saved.result && (
        <>
          <PracticeTodayProgress
            today={props.today}
            nickname={props.nickname}
            fromToday={props.fromToday}
            currentItemId={props.item.id}
          />
          <SubmissionResult result={saved.result} />
        </>
      )}
    </>
  )
}

type WrittenWord = { drawing: WritingTemplate; recognition: Recognition }
function PassageSession(props: SessionProps) {
  const [drawing, setDrawing] = useState<WritingTemplate | null>(null),
    [active, setActive] = useState(false)
  const [words, setWords] = useState<WrittenWord[]>([]),
    [committing, setCommitting] = useState(false)
  const recognition = useRecognition(
    props.studentId,
    props.item.id,
    drawing,
    active,
    props.ready,
  )
  const saved = useSavedSubmission(props)
  const expected = props.item.textValue
    .replace(/[.,;:!?"()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const locked = saved.busy || committing || !!saved.result
  async function commit() {
    if (!drawing || active || locked || words.length >= 99) return
    setCommitting(true)
    try {
      const prediction = recognition.data ?? (await recognition.run())
      if (!prediction) return
      setWords((previous) => [
        ...previous,
        { drawing, recognition: prediction },
      ])
      setDrawing(null)
    } finally {
      setCommitting(false)
    }
  }
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof HTMLElement) ||
        event.target.closest(
          'input,textarea,select,button,a,[contenteditable="true"]',
        )
      )
        return
      event.preventDefault()
      void commit()
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  })
  return (
    <>
      <header className="section-heading page-title">
        <div>
          <h1>Viết từ, câu & đoạn văn</h1>
          <p>
            Viết từng từ trong khung ngang, nhận dạng rồi chốt từ. Các từ ghép
            thành bài ở khung bên cạnh.
          </p>
        </div>
        <Link to={`/bai-hoc/${props.lessonId}`} className="text-button">
          Về bài học
        </Link>
      </header>
      <section className="panel passage-reference">
        <span>Bài cần viết</span>
        <p>{props.item.textValue}</p>
        <small>
          Bé viết từ hiện tại:{' '}
          <strong>{expected[words.length] ?? 'Từ tiếp theo'}</strong> · Không
          cần chép dấu câu ở cuối từ. Bài từ/câu đối chiếu nội dung từ, bỏ qua
          hoa/thường và dấu câu.
        </small>
      </section>
      <div className="passage-practice-layout">
        <section className="panel practice-workspace">
          <DrawingCanvas
            value={drawing}
            onChange={setDrawing}
            disabled={locked}
            guide={expected[words.length] ?? ''}
            mode="practice"
            layout="wide"
            onActivityChange={setActive}
          />
          <div className="recognition-controls">
            <button
              className="soft-button"
              disabled={
                locked ||
                active ||
                !drawing ||
                !props.ready ||
                recognition.loading
              }
              onClick={() => void recognition.run()}
            >
              Nhận dạng thử từ
            </button>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recognition.automatic}
                onChange={(e) => recognition.setAutomatic(e.target.checked)}
              />{' '}
              Tự đọc sau khi nhấc bút
            </label>
          </div>
          <RecognitionPreview
            data={recognition.data}
            loading={recognition.loading}
            error={recognition.error}
          />
          <div className="practice-submit-actions">
            <button
              className="primary-button"
              disabled={
                locked ||
                active ||
                !drawing ||
                !props.ready ||
                words.length >= 99
              }
              onClick={() => void commit()}
            >
              {committing ? 'Đang đọc từ...' : 'Xong từ này'}
              <Icon name="arrow" size={18} />
            </button>
            <span className="keyboard-hint">Phím Space để chốt từ</span>
          </div>
        </section>
        <aside className="panel passage-document">
          <div className="small-heading">
            <h2>Bài của bé</h2>
            <span>{words.length} từ</span>
          </div>
          {words.length ? (
            <div className="written-word-list">
              {words.map((word, i) => (
                <article
                  key={i}
                  className={
                    word.recognition.uncertain ||
                    word.recognition.text
                      .normalize('NFC')
                      .toLocaleLowerCase('vi')
                      .replace(/[.,;:!?"()]/g, '')
                      .trim() !== (expected[i] ?? '').toLocaleLowerCase('vi')
                      ? 'uncertain-word'
                      : ''
                  }
                >
                  <span>{i + 1}</span>
                  <strong>{word.recognition.text || '(chưa đọc rõ)'}</strong>
                  <small>
                    {Math.round(word.recognition.confidence * 100)}%
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <p className="assessment-note">
              Từ bé đã chốt sẽ xuất hiện ở đây. Bé có thể sửa từ cuối trước khi
              gửi bài.
            </p>
          )}
          <button
            className="soft-button"
            disabled={locked || !words.length || !!drawing}
            onClick={() => {
              const last = words.at(-1)!
              setWords((v) => v.slice(0, -1))
              setDrawing(last.drawing)
            }}
          >
            Sửa từ cuối
          </button>
          <p className="assessment-note">
            {drawing
              ? 'Còn từ đang viết: bấm “Xong từ này” hoặc xóa nét hiện tại trước khi gửi cả bài.'
              : 'Đã chốt xong? Gửi cả bài để lưu và đối chiếu từng từ.'}
          </p>
          <button
            className="primary-button"
            disabled={
              locked || active || !!drawing || !words.length || !props.ready
            }
            onClick={() =>
              void saved.save(
                words.map((w) => w.drawing),
                true,
              )
            }
          >
            {saved.busy ? 'Đang đối chiếu & lưu...' : 'Gửi cả bài để nhận xét'}
          </button>
          {saved.result && (
            <button
              className="soft-button"
              onClick={() => {
                saved.reset()
                setWords([])
                setDrawing(null)
              }}
            >
              Bắt đầu bài mới
            </button>
          )}
          {saved.error && (
            <p role="alert" className="form-error">
              {saved.error}
            </p>
          )}
        </aside>
      </div>
      {saved.result && (
        <>
          <PracticeTodayProgress
            today={props.today}
            nickname={props.nickname}
            fromToday={props.fromToday}
            currentItemId={props.item.id}
          />
          <SubmissionResult result={saved.result} />
        </>
      )}
    </>
  )
}

function PracticeTodayProgress({
  today,
  nickname,
  fromToday,
  currentItemId,
}: {
  today: TodayPlan | null
  nickname: string
  fromToday: boolean
  currentItemId: number
}) {
  if (!today) return null
  const nextItem = fromToday
    ? (today.planItems.find(
        (i) => i.doneToday < i.repetitions && i.itemId !== currentItemId,
      ) ?? today.planItems.find((i) => i.doneToday < i.repetitions))
    : undefined
  if (today.dailyTarget == null && !nextItem) return null
  return (
    <div className="practice-today-after">
      <DailyGoal today={today} nickname={nickname} compact />
      {nextItem && (
        <div className="practice-next-today">
          <Link to={practiceLinkForToday(nextItem)} className="primary-button">
            Bài tiếp theo hôm nay: {nextItem.textValue}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      )}
    </div>
  )
}
