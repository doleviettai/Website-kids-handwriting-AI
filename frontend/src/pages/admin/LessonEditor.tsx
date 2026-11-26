import { useState } from 'react'
import type { FormEvent } from 'react'
import type { ApiLesson } from '../../api/types'
import { api, apiError } from '../../api/client'
import { Modal } from '../../components/Modal'
import { Icon } from '../../components/Icons'

export function LessonEditor({
  lesson,
  onClose,
  onSaved,
}: {
  lesson: ApiLesson | null
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const payload = {
      title: String(data.get('title')).trim().normalize('NFC'),
      gradeLevel: data.get('gradeLevel'),
      sortOrder: Number(data.get('sortOrder')),
    }
    if (!payload.title) {
      setError('Nhập tên bài học.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (lesson) await api.put(`/admin/lessons/${lesson.id}`, payload)
      else await api.post('/admin/lessons', payload)
      onSaved()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={lesson ? 'Chỉnh sửa bài học' : 'Thêm bài học mới'}
      busy={busy}
      onClose={onClose}
    >
      <p className="dialog-intro">
        Đặt tên và cấp học phù hợp. Sau khi lưu, bạn có thể thêm các nội dung
        vào bài.
      </p>
      <form className="account-form" onSubmit={save}>
        <label>
          Tên bài học
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={lesson?.title ?? ''}
            placeholder="Ví dụ: Cùng viết chữ a, ă, â"
            autoFocus
            disabled={busy}
          />
        </label>
        <div className="form-grid">
          <label>
            Cấp học
            <select
              name="gradeLevel"
              aria-label="Cấp học"
              defaultValue={lesson?.gradeLevel ?? 'MAU_GIAO'}
              disabled={busy}
            >
              <option value="MAU_GIAO">Mẫu giáo</option>
              <option value="LOP_1">Lớp 1</option>
              <option value="LOP_2">Lớp 2</option>
              <option value="LOP_3">Lớp 3</option>
              <option value="LOP_4">Lớp 4</option>
              <option value="LOP_5">Lớp 5</option>
            </select>
          </label>
          <label>
            Thứ tự hiển thị
            <input
              name="sortOrder"
              type="number"
              min={0}
              max={2147483647}
              step={1}
              defaultValue={lesson?.sortOrder ?? 0}
              required
              disabled={busy}
            />
          </label>
        </div>
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
            Hủy
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? 'Đang lưu...' : 'Lưu bài học'}
            <Icon name="check" size={18} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
