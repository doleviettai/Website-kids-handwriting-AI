import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, PointerEvent } from 'react'
import type { Lesson, Point, Stroke, Submission } from '../types'
import { Icon } from './Icons'
import { Mascot } from './Artwork'

export function Practice({
  lesson,
  onSave,
  onBack,
  muted,
}: {
  lesson: Lesson
  onSave: (submission: Submission) => void
  onBack: () => void
  muted: boolean
}) {
  const [index, setIndex] = useState(0)
  const [source, setSource] = useState<'TOUCH' | 'CAMERA'>('TOUCH')
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const current = useRef<Stroke>([])
  const activePointer = useRef<number | null>(null)
  const [penColor, setPenColor] = useState('#7e57b4')
  const [showGuide, setShowGuide] = useState(true)
  const [saved, setSaved] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const requestRef = useRef(0)
  const item = lesson.items[index]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 900, 420)
    ctx.strokeStyle = penColor
    ctx.fillStyle = penColor
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const stroke of strokes) {
      if (!stroke.length) continue
      ctx.beginPath()
      ctx.moveTo(stroke[0].x, stroke[0].y)
      for (const p of stroke) ctx.lineTo(p.x, p.y)
      ctx.stroke()
      if (stroke.length === 1) {
        ctx.beginPath()
        ctx.arc(stroke[0].x, stroke[0].y, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [strokes, penColor, source, saved])

  useEffect(
    () => () => {
      requestRef.current++
      streamRef.current?.getTracks().forEach((track) => track.stop())
      if (image) URL.revokeObjectURL(image)
    },
    [image],
  )

  useEffect(() => {
    if (cameraOn && videoRef.current)
      videoRef.current.srcObject = streamRef.current
  }, [cameraOn])

  function point(event: PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.round(((event.clientX - rect.left) * 900) / rect.width),
      y: Math.round(((event.clientY - rect.top) * 420) / rect.height),
      t: Date.now(),
    }
  }
  function startStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || current.current.length) return
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointer.current = event.pointerId
    current.current = [point(event)]
    setSaved(false)
  }
  function moveStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!current.current.length || activePointer.current !== event.pointerId)
      return
    const p = point(event),
      previous = current.current.at(-1)!
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(previous.x, previous.y)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
    current.current.push(p)
  }
  function endStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (!current.current.length || activePointer.current !== event.pointerId)
      return
    const completedStroke = [...current.current]
    current.current = []
    activePointer.current = null
    setStrokes((previous) => [...previous, completedStroke])
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function stopCamera() {
    requestRef.current++
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }
  async function openCamera() {
    setError('')
    const request = ++requestRef.current
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      if (request !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      setCameraOn(true)
    } catch {
      setError(
        'Chưa mở được camera. Ba mẹ kiểm tra quyền camera hoặc chọn ảnh có sẵn nhé.',
      )
    }
  }
  function capture() {
    const video = videoRef.current
    if (!video?.videoWidth) {
      setError('Camera đang khởi động, bé đợi một chút nhé.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setImage(URL.createObjectURL(blob))
          setSaved(false)
        }
      },
      'image/jpeg',
      0.85,
    )
    stopCamera()
  }
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Ba mẹ chọn ảnh JPG, PNG hoặc WebP nhé.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Ảnh hơi lớn. Ba mẹ chọn ảnh dưới 10 MB nhé.')
      return
    }
    stopCamera()
    setError('')
    setImage(URL.createObjectURL(file))
    setSaved(false)
  }
  function save() {
    if (saved || (source === 'TOUCH' ? !strokes.length : !image)) return
    onSave({
      id: crypto.randomUUID(),
      student_id: 1,
      item_id: `${lesson.id}:${item.normalize('NFC')}`,
      lesson_id: lesson.id,
      expected_text: item.normalize('NFC'),
      source,
      stroke_data: source === 'TOUCH' ? strokes : null,
      shape_score: null,
      similarity_score: null,
      direction_score: null,
      stroke_order_score: null,
      predicted_text: null,
      confidence: null,
      total_score: null,
      stars: null,
      feedback_text:
        'Bài viết đã được lưu trên thiết bị. Đang chờ kết nối hệ thống AI để nhận xét.',
      created_at: new Date().toISOString(),
      status: 'PENDING_AI',
    })
    setSaved(true)
  }
  function selectItem(next: number) {
    stopCamera()
    setIndex(next)
    setStrokes([])
    current.current = []
    activePointer.current = null
    setImage(null)
    setSaved(false)
    setError('')
  }
  function speak() {
    if (muted || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(item)
    utterance.lang = 'vi-VN'
    utterance.rate = 0.7
    window.speechSynthesis.speak(utterance)
  }
  async function download() {
    const exportCanvas = document.createElement('canvas')
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    let picture: CanvasImageSource | null = canvasRef.current
    if (source === 'CAMERA') {
      if (!image) return
      const photo = new Image()
      photo.src = image
      try {
        await photo.decode()
      } catch {
        setError('Ảnh chưa tải xong. Ba mẹ thử tải lại nhé.')
        return
      }
      picture = photo
    }
    if (!picture) return
    exportCanvas.width = picture.width as number
    exportCanvas.height = picture.height as number
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    ctx.drawImage(picture, 0, 0)
    const link = document.createElement('a')
    link.href = exportCanvas.toDataURL('image/png')
    link.download = `bai-viet-${lesson.id}-${index + 1}.png`
    link.click()
  }

  return (
    <div className="practice-page page-enter">
      <button
        className="back-link"
        onClick={() => {
          stopCamera()
          onBack()
        }}
      >
        <Icon name="arrow" className="rotate-back" size={18} /> Quay lại bài học
      </button>
      <div className="section-heading">
        <div>
          <span className="eyebrow">GÓC LUYỆN VIẾT CỦA BÉ</span>
          <h1>{lesson.title}</h1>
          <p>Mỗi nét bút là một bước tiến. Mình cùng thử nhé!</p>
        </div>
        <div className="practice-count">
          {index + 1}
          <span> / {lesson.items.length}</span>
        </div>
      </div>
      <div className="practice-layout">
        <aside className="practice-guide panel">
          <span className="eyebrow">HÔM NAY BÉ VIẾT</span>
          <div
            className={`sample-letter ${item.length > 5 ? 'sample-sentence' : ''}`}
          >
            {item}
          </div>
          <button
            className="soft-button"
            onClick={speak}
            disabled={muted || !('speechSynthesis' in window)}
          >
            <Icon name="volume" size={18} /> Nghe phát âm
          </button>
          <div className="item-picker">
            {lesson.items.map((text, i) => (
              <button
                key={text}
                onClick={() => selectItem(i)}
                aria-pressed={i === index}
                className={i === index ? 'selected' : ''}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="guide-tip">
            <Icon name="leaf" size={20} />
            <p>
              Ngồi thẳng lưng, thả lỏng tay. Bé cứ viết chậm và thật thoải mái
              nhé!
            </p>
          </div>
          <Mascot className="practice-mascot" />
        </aside>
        <section className="writing-panel panel">
          <div className="writing-toolbar">
            <div className="segmented">
              <button
                className={source === 'TOUCH' ? 'active' : ''}
                onClick={() => {
                  stopCamera()
                  setSource('TOUCH')
                  setSaved(false)
                }}
              >
                <Icon name="pen" size={18} /> Viết trên màn hình
              </button>
              <button
                className={source === 'CAMERA' ? 'active' : ''}
                onClick={() => {
                  setSource('CAMERA')
                  setSaved(false)
                }}
              >
                <Icon name="camera" size={18} /> Chụp bài viết
              </button>
            </div>
          </div>
          {source === 'TOUCH' ? (
            <>
              <div className="canvas-tools">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={showGuide}
                    onChange={(e) => setShowGuide(e.target.checked)}
                  />{' '}
                  Hiện chữ gợi ý
                </label>
                <div className="pen-colors">
                  {['#7e57b4', '#343c79', '#ff6b6b', '#38bdf8'].map((color) => (
                    <button
                      key={color}
                      className={penColor === color ? 'selected' : ''}
                      style={{ background: color }}
                      aria-label={`Màu bút ${color}`}
                      aria-pressed={penColor === color}
                      onClick={() => setPenColor(color)}
                    />
                  ))}
                </div>
              </div>
              <div className="writing-surface">
                {showGuide && (
                  <span
                    className={`trace-letter ${item.length > 5 ? 'trace-sentence' : ''}`}
                    aria-hidden="true"
                  >
                    {item}
                  </span>
                )}
                <canvas
                  ref={canvasRef}
                  width={900}
                  height={420}
                  aria-label={`Vùng viết chữ ${item}, dùng chuột, bút cảm ứng hoặc ngón tay`}
                  onPointerDown={startStroke}
                  onPointerMove={moveStroke}
                  onPointerUp={endStroke}
                  onPointerCancel={endStroke}
                  onLostPointerCapture={endStroke}
                />
              </div>
              <div className="canvas-footer">
                <span>
                  <Icon name="pen" size={15} /> {strokes.length} nét đã viết
                </span>
                <div>
                  <button
                    onClick={() => {
                      setStrokes((s) => s.slice(0, -1))
                      setSaved(false)
                    }}
                    disabled={!strokes.length}
                  >
                    <Icon name="undo" size={17} /> Hoàn tác
                  </button>
                  <button
                    onClick={() => {
                      setStrokes([])
                      setSaved(false)
                    }}
                    disabled={!strokes.length}
                  >
                    <Icon name="trash" size={17} /> Viết lại
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="camera-area">
              {cameraOn ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted />
                  <button className="primary-button" onClick={capture}>
                    <Icon name="camera" /> Chụp ảnh
                  </button>
                  <button className="text-button" onClick={stopCamera}>
                    Đóng camera
                  </button>
                </>
              ) : image ? (
                <>
                  <img src={image} alt="Ảnh bài luyện viết vừa chọn" />
                  <button
                    className="soft-button"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Icon name="upload" size={18} /> Chọn ảnh khác
                  </button>
                </>
              ) : (
                <>
                  <div className="upload-icon">
                    <Icon name="camera" size={40} />
                  </div>
                  <h3>Mang trang vở của bé vào đây</h3>
                  <p>Chụp thẳng trang giấy, đủ sáng và nhìn rõ chữ viết nhé.</p>
                  <div className="camera-actions">
                    <button className="primary-button" onClick={openCamera}>
                      <Icon name="camera" size={19} /> Mở camera
                    </button>
                    <button
                      className="soft-button"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Icon name="upload" size={19} /> Tải ảnh lên
                    </button>
                  </div>
                  <small>JPG, PNG, WebP · Tối đa 10 MB</small>
                </>
              )}
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={upload}
              />
              {error && (
                <p className="error-message" role="alert">
                  {error}
                </p>
              )}
            </div>
          )}
          <div className="practice-actions">
            <span>
              <Icon name="heart" size={16} /> Cố gắng của bé luôn đáng khen!
            </span>
            <button
              className="primary-button"
              disabled={
                saved || (source === 'TOUCH' ? !strokes.length : !image)
              }
              onClick={save}
            >
              <Icon name={saved ? 'check' : 'check'} size={19} />
              {saved ? 'Đã lưu bài viết' : 'Con viết xong rồi'}
            </button>
          </div>
          {saved && (
            <div className="saved-result" role="status">
              <Icon name="check" />
              <div>
                <h3>Một bài viết mới, một bước tiến mới!</h3>
                <p>
                  Đã lưu lượt luyện tập trên thiết bị. Nhận dạng, điểm và nhận
                  xét sẽ có khi hệ thống AI được kết nối.
                  {source === 'CAMERA' &&
                    ' Ảnh hiện chỉ được xem trong phiên này; ba mẹ có thể tải về để giữ lại.'}
                </p>
                <div className="result-actions">
                  <button className="text-button" onClick={download}>
                    <Icon name="download" size={16} /> Tải bài viết
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      index + 1 < lesson.items.length
                        ? selectItem(index + 1)
                        : onBack()
                    }
                  >
                    {index + 1 < lesson.items.length
                      ? 'Viết chữ tiếp theo'
                      : 'Về danh sách bài học'}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
