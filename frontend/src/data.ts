import type { ItemType, Lesson } from './types'

export const categories: {
  value: ItemType | 'ALL'
  label: string
  icon: string
}[] = [
  { value: 'ALL', label: 'Tất cả', icon: 'grid' },
  { value: 'LETTER', label: 'Chữ cái', icon: 'letter' },
  { value: 'DIGIT', label: 'Chữ số', icon: 'numbers' },
  { value: 'DIGRAPH', label: 'Chữ ghép', icon: 'layers' },
  { value: 'WORD', label: 'Từ & câu', icon: 'book' },
]
export const lessons: Lesson[] = [
  {
    id: 1,
    title: 'Làm quen nét cơ bản',
    description: 'Nét thẳng, nét cong và những nét đầu tiên.',
    grade_level: 'MAU_GIAO',
    item_type: 'LETTER',
    items: ['i', 'u', 'ư', 't'],
    color: 'mint',
    illustration: 'strokes',
    minutes: 5,
  },
  {
    id: 2,
    title: 'Chữ a, ă, â',
    description: 'Cùng khám phá gia đình chữ a nhé!',
    grade_level: 'MAU_GIAO',
    item_type: 'LETTER',
    items: ['a', 'ă', 'â'],
    color: 'coral',
    illustration: 'letters',
    minutes: 7,
  },
  {
    id: 3,
    title: 'Những con số đầu tiên',
    description: 'Tập đếm và viết từ 0 đến 5.',
    grade_level: 'MAU_GIAO',
    item_type: 'DIGIT',
    items: ['0', '1', '2', '3', '4', '5'],
    color: 'sky',
    illustration: 'numbers',
    minutes: 8,
  },
  {
    id: 4,
    title: 'Chữ o, ô, ơ',
    description: 'Những nét tròn xinh như ông mặt trời.',
    grade_level: 'MAU_GIAO',
    item_type: 'LETTER',
    items: ['o', 'ô', 'ơ'],
    color: 'grape',
    illustration: 'round',
    minutes: 7,
  },
  {
    id: 5,
    title: 'Cùng viết chữ ghép',
    description: 'Ghép ch, nh, th, kh thành bạn mới.',
    grade_level: 'LOP_1',
    item_type: 'DIGRAPH',
    items: ['ch', 'nh', 'th', 'kh', 'ng', 'ngh', 'gh', 'tr', 'ph'],
    color: 'grape',
    illustration: 'compound',
    minutes: 10,
  },
  {
    id: 6,
    title: 'Từ ngữ quanh em',
    description: 'Viết những điều bé yêu mỗi ngày.',
    grade_level: 'LOP_1',
    item_type: 'WORD',
    items: ['ba', 'mẹ', 'bé', 'nhà', 'cô giáo'],
    color: 'mint',
    illustration: 'words',
    minutes: 10,
  },
  {
    id: 7,
    title: 'Viết câu thật xinh',
    description: 'Mỗi câu chữ là một câu chuyện nhỏ.',
    grade_level: 'LOP_1',
    item_type: 'SENTENCE',
    items: [
      'Bé yêu mẹ.',
      'Em đi học.',
      'Nhà em có một chú mèo.',
      'Mỗi ngày đến trường là một ngày vui.',
    ],
    color: 'coral',
    illustration: 'sentence',
    minutes: 12,
  },
  {
    id: 8,
    title: 'Đếm thêm một chút',
    description: 'Bé chinh phục những con số từ 6 đến 9.',
    grade_level: 'MAU_GIAO',
    item_type: 'DIGIT',
    items: ['6', '7', '8', '9'],
    color: 'sunny',
    illustration: 'more-numbers',
    minutes: 8,
  },
  {
    id: 9,
    title: 'Chữ b, d, đ',
    description: 'Nét khuyết và nét cong cùng nhau vui học.',
    grade_level: 'LOP_1',
    item_type: 'LETTER',
    items: ['b', 'd', 'đ'],
    color: 'sky',
    illustration: 'more-letters',
    minutes: 8,
  },
]
export const gradeLabels: Record<
  'MAU_GIAO' | 'LOP_1' | 'LOP_2' | 'LOP_3' | 'LOP_4' | 'LOP_5',
  string
> = {
  MAU_GIAO: 'Mẫu giáo',
  LOP_1: 'Lớp 1',
  LOP_2: 'Lớp 2',
  LOP_3: 'Lớp 3',
  LOP_4: 'Lớp 4',
  LOP_5: 'Lớp 5',
}
export const gradeOptions = (
  Object.keys(gradeLabels) as Array<keyof typeof gradeLabels>
).map((value) => ({ value, label: gradeLabels[value] }))
export const subjectLabels: Record<'TIENG_VIET' | 'TOAN', string> = {
  TIENG_VIET: 'Tiếng Việt',
  TOAN: 'Toán',
}
export const typeLabels = {
  LETTER: 'Chữ cái',
  DIGIT: 'Chữ số',
  DIGRAPH: 'Chữ ghép',
  WORD: 'Từ ngữ',
  SENTENCE: 'Câu văn',
}
