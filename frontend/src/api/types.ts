import type { Grade, ItemType, Stroke } from '../types'

export type Account = {
  id: number
  email: string
  fullName: string
  role: 'PARENT' | 'ADMIN'
}
export type AuthResponse = {
  accessToken: string
  expiresIn: number
  user: Account
}
export type Student = {
  id: number
  nickname: string
  birthYear: number | null
  gradeLevel: Grade
  createdAt: string
}
export type StudentInput = {
  nickname: string
  birthYear: number
  gradeLevel: Grade
}
export type WritingItem = {
  id: number
  itemType: ItemType
  textValue: string
  difficulty: number
  sortOrder: number
  template: WritingTemplate | null
}
export type WritingTemplate = {
  width: number
  height: number
  strokes: Stroke[]
}
export type AdminItem = WritingItem & { lessonId: number | null }
export type ErrorType = {
  id: number
  code: string
  nameVi: string
  feedbackTemplateVi: string
}
export type ApiLesson = {
  id: number
  title: string
  gradeLevel: Grade
  sortOrder: number
  items: WritingItem[]
}
export type ItemProgress = {
  itemId: number
  attempts: number
  bestScore: number | null
  lastScore: number | null
  mastered: boolean
}
export type Overview = {
  submissions: number
  practicedItems: number
  masteredItems: number
  averageScore: number | null
  progress: ItemProgress[]
  activity: { date: string; attempts: number; averageScore: number | null }[]
}
export type HistoryPage = {
  content: {
    id: number
    itemId: number
    expectedText: string
    source: 'TOUCH' | 'CAMERA'
    predictedText: string | null
    totalScore: number | null
    stars: number | null
    feedbackText: string | null
    createdAt: string
  }[]
  page: number
  totalPages: number
  totalElements: number
}
export type AdminOverview = {
  users: number
  students: number
  submissions: number
  lessons: number
  averageScore: number | null
}
export type AiStatus = {
  status: string
  message?: string
  cameraSupported?: boolean
  paragraphMode?: string
  models: Record<
    string,
    { ready: boolean; modelPath: string; version: string; message: string }
  >
}
export type Finding = {
  code: string
  nameVi: string
  feedback: string
  segmentIndex: number | null
  strokeIndex: number | null
}
export type SubmissionDetail = {
  task?: 'SINGLE_CHAR' | 'COMPOUND' | 'PARAGRAPH'
  id: number
  studentId: number
  nickname: string
  itemId: number
  lessonId: number | null
  expectedText: string
  predictedText: string
  source: 'TOUCH' | 'CAMERA'
  modelName: string | null
  modelVersion: string | null
  confidence: number
  textAccuracy: number
  correct: boolean
  shapeScore: number | null
  similarityScore: number | null
  directionScore: number | null
  strokeOrderScore: number | null
  totalScore: number
  stars: number
  feedbackText: string
  assessmentMethod: string
  strokes: Stroke[]
  segments: {
    index: number
    expected: string
    predicted: string
    confidence: number | null
    score: number
    strokeStart: number | null
    strokeEnd: number | null
  }[]
  errors: Finding[]
  createdAt: string
}
export type Attention = {
  code: string
  nameVi: string
  feedback: string
  occurrences: number
}
export type ReviewPage = {
  content: {
    id: number
    studentId: number
    nickname: string
    expectedText: string
    predictedText: string
    totalScore: number | null
    confidence: number | null
    createdAt: string
    errors: number
  }[]
  page: number
  totalPages: number
  totalElements: number
}
export type Recognition = {
  text: string
  confidence: number
  uncertain: boolean
  candidates: { text: string; confidence: number | null }[]
  chars: { text: string; confidence: number | null }[]
  suggestedText: string
  preview: string | null
}
