import { useEffect, useState } from 'react'
import { api, apiError } from '../api/client'

export function useResource<T>(url: string | null, identity = '') {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{
    key: string
    data: T | null
    error: string | null
  }>({ key: '', data: null, error: null })
  const key = url === null ? null : `${identity}:${url}:${revision}`
  useEffect(() => {
    if (url === null || key === null) return
    const controller = new AbortController()
    api
      .get<T>(url, { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted)
          setResult({ key, data: response.data, error: null })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({ key, data: null, error: apiError(error) })
      })
    return () => controller.abort()
  }, [url, key])
  const current = key !== null && result.key === key
  return {
    data: current ? result.data : null,
    error: current ? result.error : null,
    loading: key !== null && !current,
    reload: () => setRevision((v) => v + 1),
  }
}
