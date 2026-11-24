import { useState } from 'react'
import { api, apiError } from '../api/client'
import { Modal } from './Modal'

export function DeleteDialog({
  title,
  description,
  url,
  onClose,
  onDeleted,
}: {
  title: string
  description: string
  url: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await api.delete(url)
      onDeleted()
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={title} busy={busy} onClose={onClose}>
      <p className="dialog-intro">{description}</p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="soft-button" disabled={busy} onClick={onClose}>
          Giữ lại
        </button>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? 'Đang xóa...' : 'Xác nhận xóa'}
        </button>
      </div>
    </Modal>
  )
}
