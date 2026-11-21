export type Grade = 'MAU_GIAO' | 'LOP_1'
export type ItemType = 'LETTER' | 'DIGIT' | 'DIGRAPH' | 'WORD' | 'SENTENCE'
export type ModelTask = 'SINGLE_CHAR' | 'COMPOUND' | 'PARAGRAPH'
export type Point = { x: number; y: number; t: number }
export type Stroke = Point[]
export type Lesson = {
  id: number
  title: string
  description: string
  grade_level: Grade
  item_type: ItemType
  items: string[]
  color: string
  illustration: string
  minutes: number
}
export type Submission = {
  id: string
  student_id: number
  item_id: string
  lesson_id: number
  expected_text: string
  source: 'TOUCH' | 'CAMERA'
  stroke_data: Stroke[] | null
  shape_score: null
  similarity_score: null
  direction_score: null
  stroke_order_score: null
  predicted_text: null
  confidence: null
  total_score: null
  stars: null
  feedback_text: string
  created_at: string
  status: 'PENDING_AI'
}
export type Profile = {
  nickname: string
  grade_level: Grade
  birth_year: number
  daily_goal: number
}
export const modelTaskFor = (type: ItemType): ModelTask =>
  type === 'LETTER' || type === 'DIGIT'
    ? 'SINGLE_CHAR'
    : type === 'DIGRAPH'
      ? 'COMPOUND'
      : 'PARAGRAPH'
