import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from './auth-context'
import { useResource } from '../hooks/useResource'
import type { ApiLesson, Overview, Student } from '../api/types'
import { WorkspaceContext } from './workspace-context'

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const key = `netxinh.selected-student.${user!.id}`
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    try {
      return Number(sessionStorage.getItem(key)) || null
    } catch {
      return null
    }
  })
  const students = useResource<Student[]>(
    user!.role === 'PARENT' ? '/students' : null,
    String(user!.id),
  )
  const lessons = useResource<ApiLesson[]>('/lessons', String(user!.id))
  const selected =
    students.data?.find((s) => s.id === selectedId) ??
    students.data?.[0] ??
    null
  const overview = useResource<Overview>(
    selected ? `/students/${selected.id}/overview` : null,
    String(user!.id),
  )
  function choose(id: number) {
    setSelectedId(id)
    try {
      sessionStorage.setItem(key, String(id))
    } catch {
      /* Selection still works in memory. */
    }
  }
  return (
    <WorkspaceContext.Provider
      value={{ students, lessons, overview, selected, choose }}
    >
      {children}
    </WorkspaceContext.Provider>
  )
}
