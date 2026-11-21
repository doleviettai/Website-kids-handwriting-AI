import { useState } from 'react'

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved ? (JSON.parse(saved) as T) : initialValue
    } catch {
      return initialValue
    }
  })
  const [storageError, setStorageError] = useState(false)
  function update(next: T | ((previous: T) => T)) {
    const resolved =
      typeof next === 'function' ? (next as (previous: T) => T)(value) : next
    try {
      localStorage.setItem(key, JSON.stringify(resolved))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
    setValue(resolved)
  }
  return [value, update, storageError] as const
}
