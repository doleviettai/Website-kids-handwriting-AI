import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiError } from '../api/client'
import type { Recognition, WritingTemplate } from '../api/types'

export function useRecognition(
  studentId: number,
  itemId: number,
  drawing: WritingTemplate | null,
  active: boolean,
  ready: boolean,
) {
  const [automatic, setAutomatic] = useState(false)
  const [record, setRecord] = useState<{
    drawing: WritingTemplate
    data: Recognition | null
    error: string | null
    loading: boolean
  } | null>(null)
  const pending = useRef<AbortController | null>(null)
  const sequence = useRef(0)
  const run = useCallback(async (): Promise<Recognition | null> => {
    if (!drawing || active || !ready) return null
    pending.current?.abort()
    const controller = new AbortController(),
      id = ++sequence.current
    pending.current = controller
    setRecord({ drawing, data: null, error: null, loading: true })
    try {
      const response = await api.post<Recognition>(
        '/recognition/preview',
        { studentId, itemId, ...drawing, wordEnds: [] },
        { timeout: 100000, signal: controller.signal },
      )
      if (id !== sequence.current || controller.signal.aborted) return null
      setRecord({ drawing, data: response.data, error: null, loading: false })
      return response.data
    } catch (error) {
      if (!controller.signal.aborted && id === sequence.current)
        setRecord({
          drawing,
          data: null,
          error: apiError(error),
          loading: false,
        })
      return null
    }
  }, [studentId, itemId, drawing, active, ready])
  useEffect(() => {
    const timer =
      automatic && drawing && !active && ready
        ? window.setTimeout(() => void run(), 650)
        : null
    return () => {
      if (timer) clearTimeout(timer)
      pending.current?.abort()
    }
  }, [automatic, drawing, active, ready, run])
  const current = drawing !== null && record?.drawing === drawing && !active
  return {
    data: current ? record.data : null,
    error: current ? record.error : null,
    loading: current && record.loading,
    run,
    automatic,
    setAutomatic,
  }
}
