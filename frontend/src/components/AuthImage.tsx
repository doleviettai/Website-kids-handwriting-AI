import { useEffect, useState } from 'react'
import { api } from '../api/client'

export function AuthImage({
  url,
  alt,
  className = '',
  onClick,
}: {
  url: string
  alt: string
  className?: string
  onClick?: () => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    const relative = url.startsWith('/api/') ? url.slice(4) : url
    void api
      .get<Blob>(relative, { responseType: 'blob' })
      .then((res) => {
        if (!active) return
        objectUrl = URL.createObjectURL(res.data)
        setSrc(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  if (failed) {
    return <div className={`auth-img-fallback ${className}`}>Không tải được ảnh</div>
  }
  if (!src) {
    return <div className={`auth-img-loading ${className}`}>Đang tải...</div>
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} />
}
