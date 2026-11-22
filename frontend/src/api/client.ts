import axios from 'axios'

const TOKEN_KEY = 'netxinh.access-token.v2'
let memoryToken: string | null = null
try {
  memoryToken = sessionStorage.getItem(TOKEN_KEY)
} catch {
  /* Session works in memory when storage is unavailable. */
}

export function getAccessToken() {
  return memoryToken
}
export function setAccessToken(token: string | null) {
  memoryToken = token
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* Use memory. */
  }
}

export const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: { Accept: 'application/json' },
})
api.interceptors.request.use((config) => {
  if (memoryToken) config.headers.Authorization = `Bearer ${memoryToken}`
  return config
})
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !['/auth/login', '/auth/register'].includes(error.config?.url ?? '')
    ) {
      // An old request must not sign out a newer session.
      if (
        memoryToken &&
        error.config?.headers.Authorization === `Bearer ${memoryToken}`
      ) {
        setAccessToken(null)
        window.dispatchEvent(new Event('netxinh:unauthorized'))
      }
    }
    return Promise.reject(error)
  },
)

export function apiError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.data?.message) return error.response.data.message
    if (!error.response || error.response.status >= 500)
      return 'Chưa kết nối được máy chủ. Ba mẹ kiểm tra backend đang chạy rồi thử lại nhé.'
    if (error.response.status === 403)
      return 'Tài khoản này chưa có quyền truy cập chức năng đó.'
    if (error.response.status === 404)
      return 'Không tìm thấy dữ liệu. Ba mẹ tải lại trang nhé.'
  }
  return 'Chưa thực hiện được thao tác. Ba mẹ thử lại nhé.'
}
