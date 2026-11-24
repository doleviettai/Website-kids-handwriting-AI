import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AdminItem, ApiLesson, WritingTemplate } from '../../api/types'
import { api, apiError } from '../../api/client'
import type { ItemType } from '../../types'
import { typeLabels } from '../../data'
import { Modal } from '../../components/Modal'
import { DrawingCanvas } from '../../components/DrawingCanvas'
import { Icon } from '../../components/Icons'

export function ItemEditor({
  item,
  lessons,
  initialLesson,
  onClose,
  onSaved,
}: {
  item: AdminItem | null
  lessons: ApiLesson[]
  initialLesson: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const [text, setText] = useState(item?.textValue ?? '')
  const [template, setTemplate] = useState<WritingTemplate | null>(
    item?.template ?? null,
  )
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const normalized = text.trim().normalize('NFC')
    if (!normalized) {
      setError('Nhập chữ, số, từ hoặc câu.')
      return
    }
    const payload = {
      lessonId: data.get('lessonId') ? Number(data.get('lessonId')) : null,
      itemType: data.get('itemType') as ItemType,
      textValue: normalized,
      difficulty: Number(data.get('difficulty')),
      sortOrder: Number(data.get('sortOrder')),
      template,
    }
    setBusy(true)
    setError('')
    try {
      if (item) await api.put(`/admin/items/${item.id}`, payload)
      else await api.post('/admin/items', payload)
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={item ? 'Chỉnh sửa nội dung & mẫu nét' : 'Thêm nội dung học'}
      busy={busy}
      onClose={onClose}
    >
      <form className="account-form item-editor-form" onSubmit={save}>
        <div className="form-grid">
          <label>
            Thuộc bài học
            <select
              name="lessonId"
              aria-label="Thuộc bài học"
              defaultValue={item?.lessonId ?? initialLesson ?? ''}
              disabled={busy}
            >
              <option value="">Chưa xếp bài</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Loại nội dung
            <select
              name="itemType"
              aria-label="Loại nội dung"
              defaultValue={item?.itemType ?? 'LETTER'}
              disabled={busy}
            >
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Chữ / số / từ / câu
          <input
            name="textValue"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            maxLength={255}
            placeholder="Ví dụ: a, 3, ch, bé, Bé đi học."
            disabled={busy}
          />
        </label>
        <div className="form-grid">
          <label>
            Độ khó
            <select
              name="difficulty"
              aria-label="Độ khó"
              defaultValue={item?.difficulty ?? 1}
              disabled={busy}
            >
              <option value={1}>1 · Làm quen</option>
              <option value={2}>2 · Luyện tập</option>
              <option value={3}>3 · Thử thách</option>
            </select>
          </label>
          <label>
            Thứ tự trong bài
            <input
              type="number"
              name="sortOrder"
              required
              min={0}
              max={2147483647}
              step={1}
              defaultValue={item?.sortOrder ?? 0}
              disabled={busy}
            />
          </label>
        </div>
        <DrawingCanvas
          value={template}
          onChange={setTemplate}
          guide={text}
          disabled={busy}
        />
        {error && (
          <p className="form-error" role="alert">
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
            Hủy thay đổi
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu nội dung'}
            <Icon name="check" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
