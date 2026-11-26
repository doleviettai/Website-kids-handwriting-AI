import type { Grade, ItemType, Stroke, Subject } from '../types'

export type Account = {
  id: number
  email: string
  fullName: string
  role: 'PARENT' | 'TEACHER' | 'ADMIN'
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
export type GoalResponse = {
  dailyTarget: number | null
  updatedAt: string | null
}
export type PlanItem = {
  itemId: number
  lessonId: number | null
  itemType: ItemType
  textValue: string
  repetitions: number
  sortOrder: number
}
export type PracticePlan = {
  id: number
  studentId: number
  title: string
  startDate: string
  endDate: string
  items: PlanItem[]
  createdAt: string
}
export type TodayItem = {
  itemId: number
  lessonId: number | null
  itemType: ItemType
  textValue: string
  repetitions: number
  doneToday: number
}
export type TodayPlan = {
  date: string
  dailyTarget: number | null
  doneToday: number
  goalReached: boolean
  planItems: TodayItem[]
}
export type AppNotification = {
  id: number
  type:
    | 'NEEDS_REVIEW'
    | 'NEW_COMMENT'
    | 'TEACHER_REPORT'
    | 'CLASS_INVITATION'
    | 'JOIN_REQUEST'
    | 'HOMEWORK_ASSIGNED'
    | 'HOMEWORK_GRADED'
  title: string
  message: string
  submissionId: number | null
  studentId: number | null
  read: boolean
  createdAt: string
}
export type NotificationPage = {
  items: AppNotification[]
  page: number
  totalPages: number
  totalElements: number
  unreadCount: number
}
export type UnreadCount = {
  unreadCount: number
}
export type SubmissionComment = {
  id: number
  submissionId: number
  authorName: string
  content: string
  createdAt: string
}
export type EvaluationRating = 'HOAN_THANH_TOT' | 'HOAN_THANH' | 'CAN_CO_GANG'
export type ClassroomSummary = {
  id: number
  name: string
  schoolYear: string
  gradeLevel: Grade
  joinCode: string
  studentCount: number
  batchCount: number
  createdAt: string
}
export type EnrollmentRow = {
  id: number
  studentId: number | null
  displayName: string
  birthYear: number | null
  linkedParent: boolean
  parentName: string | null
  submissionCount: number
  joinedAt: string
}
export type BatchSummary = {
  id: number
  classroomId: number
  title: string
  batchDate: string
  notes: string | null
  evaluatedCount: number
  attentionCount: number
  sentCount: number
  totalStudents: number
  createdAt: string
}
export type ClassroomDetail = {
  classroom: ClassroomSummary
  enrollments: EnrollmentRow[]
  batches: BatchSummary[]
}
export type EvaluationRow = {
  enrollmentId: number
  studentId: number | null
  displayName: string
  birthYear: number | null
  linkedParent: boolean
  parentName: string | null
  rating: EvaluationRating | null
  teacherComment: string | null
  needsAttention: boolean
  imageUrl: string | null
  sentToParentAt: string | null
  updatedAt: string | null
}
export type BatchSheet = {
  batchId: number
  classroomId: number
  classroomName: string
  schoolYear: string
  title: string
  batchDate: string
  notes: string | null
  rows: EvaluationRow[]
}
export type SendReportsResponse = {
  sentCount: number
  skippedUnlinked: number
  skippedEmpty: number
}
export type StudentClassroom = {
  enrollmentId: number
  classroomId: number
  classroomName: string
  schoolYear: string
  gradeLevel: Grade
  teacherName: string
  joinedAt: string
}
export type ParentTeacherReport = {
  evaluationId: number
  batchId: number
  batchTitle: string
  batchDate: string
  classroomName: string
  teacherName: string
  rating: EvaluationRating | null
  teacherComment: string | null
  needsAttention: boolean
  sentToParentAt: string
}


export type EnrollmentDetail = {
  id: number
  studentId: number | null
  displayName: string
  birthYear: number | null
  linkedParent: boolean
  linkedParentName: string | null
  linkedParentEmail: string | null
  parentNameNote: string | null
  parentPhone: string | null
  teacherNote: string | null
  joinedAt: string
}
export type ClassroomInvitation = {
  id: number
  classroomId: number
  classroomName: string
  schoolYear: string
  gradeLevel: Grade
  teacherName: string
  parentEmail: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'
  createdAt: string
  respondedAt: string | null
}
export type PublicClassroom = {
  id: number
  name: string
  schoolYear: string
  gradeLevel: Grade
  teacherName: string
  studentCount: number
}
export type ClassroomJoinRequest = {
  id: number
  classroomId: number
  classroomName: string
  teacherName: string
  parentId: number
  parentName: string
  parentEmail: string
  studentId: number
  studentNickname: string
  message: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  reviewedAt: string | null
}
export type AdminTeacherDetail = {
  teacherId: number
  fullName: string
  email: string
  createdAt: string
  classrooms: {
    id: number
    name: string
    schoolYear: string
    gradeLevel: Grade
    joinCode: string
    studentCount: number
    batchCount: number
    createdAt: string
  }[]
}
export type HomeworkPage = {
  id: number
  pageNumber: number
  originalFilename: string
  contentType: string
  fileSize: number
  imageUrl: string
  uploadedAt: string
}
export type HomeworkSubmissionRow = {
  enrollmentId: number
  studentId: number | null
  displayName: string
  linkedParent: boolean
  parentName: string | null
  parentEmail: string | null
  parentPhone: string | null
  evaluationId: number | null
  submittedAt: string | null
  late: boolean
  pages: HomeworkPage[]
  score: number | null
  rating: EvaluationRating | null
  gradingMode: 'MANUAL' | 'AI_ASSISTED'
  teacherComment: string | null
  needsAttention: boolean
  sentToParentAt: string | null
  scheduledSendAt: string | null
}
export type HomeworkDetail = {
  batchId: number
  classroomId: number
  classroomName: string
  gradeLevel: Grade
  title: string
  subject: Subject
  homework: boolean
  description: string | null
  batchDate: string
  dueAt: string | null
  requiredPages: number
  notes: string | null
  rows: HomeworkSubmissionRow[]
}
export type ParentHomeworkItem = {
  batchId: number
  classroomId: number
  classroomName: string
  teacherName: string
  enrollmentId: number
  title: string
  subject: Subject
  description: string | null
  batchDate: string
  dueAt: string | null
  requiredPages: number
  submittedAt: string | null
  late: boolean
  pages: HomeworkPage[]
  gradedPublished: boolean
  score: number | null
  rating: EvaluationRating | null
  teacherComment: string | null
  needsAttention: boolean
  sentToParentAt: string | null
}
export type GradebookResponse = {
  classroomId: number
  classroomName: string
  schoolYear: string
  gradeLevel: Grade
  batches: {
    batchId: number
    title: string
    subject: Subject
    homework: boolean
    batchDate: string
    dueAt: string | null
  }[]
  students: {
    enrollmentId: number
    studentId: number | null
    displayName: string
    linkedParent: boolean
    parentName: string | null
    parentPhone: string | null
    averageScore: number | null
    cells: {
      batchId: number
      submitted: boolean
      pageCount: number
      score: number | null
      rating: EvaluationRating | null
      teacherComment: string | null
      needsAttention: boolean
      sentToParentAt: string | null
      scheduledSendAt: string | null
    }[]
  }[]
}
