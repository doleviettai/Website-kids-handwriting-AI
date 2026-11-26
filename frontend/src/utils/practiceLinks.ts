import type { TodayItem } from '../api/types'
import type { ItemType } from '../types'
import { modelTaskFor } from '../types'

export function practiceSlugFor(itemType: ItemType): string {
  const task = modelTaskFor(itemType)
  if (task === 'COMPOUND') return 'chu-ghep'
  if (task === 'PARAGRAPH') return 'doan-van'
  return 'chu-don'
}

export function practiceLinkForToday(item: TodayItem): string {
  return `/luyen-tap/${practiceSlugFor(item.itemType)}?item=${item.itemId}&from=today`
}
