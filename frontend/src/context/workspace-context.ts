import { createContext, useContext } from 'react'
import type { ApiLesson, Overview, Student } from '../api/types'

export type ResourceState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}
export const WorkspaceContext = createContext<{
  students: ResourceState<Student[]>
  lessons: ResourceState<ApiLesson[]>
  overview: ResourceState<Overview>
  selected: Student | null
  choose: (id: number) => void
} | null>(null)
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('WorkspaceProvider is missing')
  return context
}
