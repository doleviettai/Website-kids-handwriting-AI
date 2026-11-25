import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Point, Stroke } from '../types'
import type { WritingTemplate } from '../api/types'
import { Icon } from './Icons'

export function DrawingCanvas({
  value,
  onChange,
  guide = '',
  disabled = false,
  mode = 'template',
  layout = 'template',
  onActivityChange,
}: {
  value: WritingTemplate | null
  onChange: (template: WritingTemplate | null) => void
  guide?: string
  disabled?: boolean
  mode?: 'template' | 'practice'
  layout?: 'template' | 'single' | 'wide'
  onActivityChange?: (active: boolean) => void
}) {
  const WIDTH = layout === 'single' ? 420 : 900
  const HEIGHT = layout === 'wide' ? 360 : 420
  const canvas = useRef<HTMLCanvasElement>(null)
  const pointer = useRef<number | null>(null)
  const current = useRef<Stroke>([])
  const animation = useRef<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [inking, setInking] = useState(false)
  const [showGuide, setShowGuide] = useState(mode === 'template')
  const [warning, setWarning] = useState('')
  const strokes: Stroke[] = useMemo(
    () =>
      (value?.strokes ?? []).map((stroke) =>
        stroke.map((p) => ({
          x: (p.x * WIDTH) / (value?.width || WIDTH),
          y: (p.y * HEIGHT) / (value?.height || HEIGHT),
          t: p.t,
        })),
      ),
    [value, WIDTH, HEIGHT],
  )
  const strokesRef = useRef(strokes)
  // Updated after a render; pointer handlers always use the most recent saved strokes.
  useEffect(() => {
    strokesRef.current = strokes
  }, [strokes])

  const paint = useCallback(
    (paths: Stroke[], numbered = true) => {
      const ctx = canvas.current?.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, WIDTH, HEIGHT)
      ctx.lineWidth = layout === 'single' ? WIDTH * 0.018 : 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      paths.forEach((stroke, i) => {
        if (!stroke.length) return
        ctx.strokeStyle = '#9471b1'
        ctx.fillStyle = '#9471b1'
        ctx.beginPath()
        ctx.moveTo(stroke[0].x, stroke[0].y)
        stroke.forEach((point) => ctx.lineTo(point.x, point.y))
        ctx.stroke()
        if (stroke.length === 1) {
          ctx.beginPath()
          ctx.arc(stroke[0].x, stroke[0].y, 3, 0, 2 * Math.PI)
          ctx.fill()
        }
        if (numbered) {
          const x = Math.min(WIDTH - 15, Math.max(15, stroke[0].x)),
            y = Math.min(HEIGHT - 15, Math.max(15, stroke[0].y - 22))
          ctx.fillStyle = '#ff8d83'
          ctx.beginPath()
          ctx.arc(x, y, 13, 0, 2 * Math.PI)
          ctx.fill()
          ctx.fillStyle = 'white'
          ctx.font = 'bold 16px Nunito, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(i + 1), x, y)
        }
      })
    },
    [WIDTH, HEIGHT, layout],
  )
  useEffect(() => {
    if (!playing) paint(strokes, mode === 'template')
  }, [strokes, playing, paint, mode])
  useEffect(
    () => () => {
      if (animation.current !== null) cancelAnimationFrame(animation.current)
    },
    [],
  )

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = canvas.current!.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(WIDTH, ((event.clientX - rect.left) * WIDTH) / rect.width),
      ),
      y: Math.max(
        0,
        Math.min(HEIGHT, ((event.clientY - rect.top) * HEIGHT) / rect.height),
      ),
      t: Math.max(
        Date.now(),
        current.current.at(-1)?.t ?? 0,
        strokesRef.current.at(-1)?.at(-1)?.t ?? 0,
      ),
    }
  }
  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || playing || pointer.current !== null || event.button !== 0)
      return
    if (strokes.length >= 100) {
      setWarning('Mẫu tối đa 100 nét. Hãy hoàn tác hoặc xóa bớt nét.')
      return
    }
    setWarning('')
    pointer.current = event.pointerId
    current.current = [point(event)]
    setInking(true)
    onActivityChange?.(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    paint([...strokesRef.current, current.current], mode === 'template')
  }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current !== event.pointerId) return
    if (
      strokesRef.current.reduce((total, stroke) => total + stroke.length, 0) +
        current.current.length >=
      20000
    ) {
      setWarning('Mẫu đã đạt 20.000 điểm. Hãy lưu hoặc đơn giản hóa mẫu.')
      return
    }
    const events = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of events.length ? events : [event]) {
      if (
        current.current.length +
          strokesRef.current.reduce((n, s) => n + s.length, 0) >=
        20000
      )
        break
      current.current.push(point(sample as PointerEvent<HTMLCanvasElement>))
    }
    paint([...strokesRef.current, current.current], mode === 'template')
  }
  function end(event: PointerEvent<HTMLCanvasElement>, cancel = false) {
    if (pointer.current !== event.pointerId) return
    const completed = [...current.current]
    current.current = []
    pointer.current = null
    setInking(false)
    onActivityChange?.(false)
    if (!cancel) {
      const updated = [...strokesRef.current, completed]
      strokesRef.current = updated
      onChange({
        width: WIDTH,
        height: HEIGHT,
        strokes: updated,
      })
    } else paint(strokesRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function stop() {
    if (animation.current !== null) cancelAnimationFrame(animation.current)
    animation.current = null
    setPlaying(false)
    paint(strokesRef.current)
  }
  function replay() {
    if (!strokes.length || playing) return
    setPlaying(true)
    const paths = strokesRef.current,
      started = performance.now(),
      duration = Math.max(1000, paths.length * 700)
    const tick = (now: number) => {
      const position = Math.min(1, (now - started) / duration) * paths.length
      const index = Math.floor(position)
      const shown = paths.slice(0, index)
      if (index < paths.length)
        shown.push(
          paths[index].slice(
            0,
            Math.max(1, Math.floor((position - index) * paths[index].length)),
          ),
        )
      paint(shown)
      if (position < paths.length)
        animation.current = requestAnimationFrame(tick)
      else {
        animation.current = null
        setPlaying(false)
      }
    }
    animation.current = requestAnimationFrame(tick)
  }
  function exportJson() {
    if (!strokes.length) return
    const url = URL.createObjectURL(
      new Blob(
        [JSON.stringify({ width: WIDTH, height: HEIGHT, strokes }, null, 2)],
        { type: 'application/json' },
      ),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'mau-net.json'
    link.click()
    URL.revokeObjectURL(url)
  }
  const locked = disabled || playing || inking
  return (
    <section className="drawing-editor" aria-label="Trình vẽ mẫu chữ">
      <div className="drawing-toolbar">
        <span>
          <Icon name="pen" size={18} />{' '}
          {mode === 'template' ? 'Mẫu chữ' : 'Bài viết của bé'} ·{' '}
          {strokes.length} nét
        </span>
        <label>
          <input
            type="checkbox"
            checked={showGuide}
            onChange={(e) => setShowGuide(e.target.checked)}
          />{' '}
          Chữ gợi ý
        </label>
      </div>
      <div className={`template-surface canvas-${layout}`}>
        {layout === 'single' && (
          <div className="single-guidelines" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {layout === 'wide' && (
          <div className="wide-guidelines" aria-hidden="true">
            <i />
            <i />
          </div>
        )}
        {showGuide && guide && (
          <span
            className={`template-guide ${guide.length > 4 ? 'long' : ''}`}
            aria-hidden="true"
          >
            {guide}
          </span>
        )}
        <canvas
          ref={canvas}
          width={WIDTH}
          height={HEIGHT}
          aria-label={
            mode === 'template'
              ? 'Khung vẽ mẫu chữ'
              : layout === 'single'
                ? 'Khung viết chữ đơn'
                : 'Khung viết ngang'
          }
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={(event) => end(event)}
          onPointerCancel={(event) => end(event, true)}
          onLostPointerCapture={(event) => end(event, true)}
          style={{ cursor: locked ? 'default' : 'crosshair' }}
        />
      </div>
      <p className="drawing-help">
        {mode === 'template'
          ? 'Vẽ bằng chuột, bút hoặc cảm ứng. Mỗi lần nhấc bút là một nét; số tròn đánh dấu thứ tự và điểm bắt đầu.'
          : 'Bé viết chậm, rõ nét. Mỗi lần nhấc tay hoặc bút sẽ bắt đầu một nét mới.'}
      </p>
      <div className="drawing-actions">
        <button
          type="button"
          className="soft-button"
          disabled={locked || !strokes.length}
          onClick={() =>
            onChange(
              strokes.length > 1
                ? {
                    width: WIDTH,
                    height: HEIGHT,
                    strokes: strokes.slice(0, -1),
                  }
                : null,
            )
          }
        >
          <Icon name="undo" size={17} /> Hoàn tác nét
        </button>
        <button
          type="button"
          className="soft-button"
          disabled={locked || !strokes.length}
          onClick={() => {
            onChange(null)
            setWarning('')
          }}
        >
          <Icon name="trash" size={17} />{' '}
          {mode === 'template' ? 'Bỏ mẫu nét' : 'Viết lại'}
        </button>
        <button
          type="button"
          className="soft-button"
          disabled={disabled || !strokes.length}
          onClick={playing ? stop : replay}
        >
          <Icon name={playing ? 'close' : 'play'} size={17} />
          {playing ? 'Dừng xem mẫu' : 'Xem thứ tự nét'}
        </button>
        <button
          type="button"
          className="text-button"
          disabled={locked || !strokes.length}
          onClick={exportJson}
        >
          <Icon name="download" size={17} /> Tải JSON
        </button>
      </div>
      {warning && (
        <p className="form-error" role="alert">
          {warning}
        </p>
      )}
      <span className="drawing-note">
        {mode === 'template'
          ? 'Mẫu được lưu cùng nội dung khi bấm “Lưu nội dung”. Để trống nếu chưa có mẫu chuẩn.'
          : 'Chữ gợi ý không được gửi cho model. Chỉ nét bút của bé được dùng để nhận dạng.'}
      </span>
    </section>
  )
}
