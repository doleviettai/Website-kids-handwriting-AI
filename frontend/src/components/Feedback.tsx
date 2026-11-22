import { Icon } from './Icons'

export function Loading({
  message = 'Pip đang chuẩn bị mọi thứ...',
}: {
  message?: string
}) {
  return (
    <div className="request-loading" role="status">
      <span className="loading-spinner" />
      {message}
    </div>
  )
}
export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="request-error" role="alert">
      <Icon name="help" size={23} />
      <div>
        <strong>Mình thử lại một chút nhé</strong>
        <p>{message}</p>
        {onRetry && (
          <button className="soft-button" onClick={onRetry}>
            Thử kết nối lại
            <Icon name="arrow" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
