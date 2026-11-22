import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icons'

export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="managed-dialog panel"
      aria-labelledby="dialog-heading"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <button
        className="icon-button dialog-close"
        onClick={onClose}
        disabled={busy}
        aria-label="Đóng"
      >
        <Icon name="close" />
      </button>
      <h2 id="dialog-heading">{title}</h2>
      {children}
    </dialog>
  )
}
