import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, apiError } from '../api/client'
import type { AuthResponse } from '../api/types'
import { useAuth } from '../context/auth-context'
import { HeroArtwork } from '../components/Artwork'
import { Icon } from '../components/Icons'
import { ErrorPanel, Loading } from '../components/Feedback'

export function AuthPage({ register = false }: { register?: boolean }) {
  const auth = useAuth(),
    navigate = useNavigate(),
    location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const backTo =
    typeof location.state?.from === 'string' &&
    location.state.from.startsWith('/') &&
    !location.state.from.startsWith('//')
      ? location.state.from
      : '/'
  if (auth.loading)
    return <Loading message="Đang kiểm tra phiên đăng nhập..." />
  if (auth.user)
    return (
      <Navigate
        to={auth.user.role === 'ADMIN' ? '/quan-tri' : backTo}
        replace
      />
    )
  if (auth.error)
    return (
      <div className="session-error">
        <ErrorPanel message={auth.error} onRetry={auth.retry} />
        <button
          className="text-button"
          onClick={() => void auth.logout().catch(() => {})}
        >
          Quay lại đăng nhập
        </button>
      </div>
    )
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email')).trim()
    const password = String(values.get('password'))
    if (new TextEncoder().encode(password).length > 72) {
      setError('Mật khẩu tối đa 72 byte. Ba mẹ chọn mật khẩu ngắn hơn nhé.')
      return
    }
    if (register && password !== values.get('confirmation')) {
      setError('Hai lần nhập mật khẩu chưa giống nhau.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const response = await api.post<AuthResponse>(
        register ? '/auth/register' : '/auth/login',
        {
          email,
          password,
          ...(register
            ? { fullName: String(values.get('fullName')).trim() }
            : {}),
        },
      )
      auth.acceptSession(response.data)
      navigate(response.data.user.role === 'ADMIN' ? '/quan-tri' : backTo, {
        replace: true,
      })
    } catch (failure) {
      setError(apiError(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="auth-page page-enter">
      <header className="auth-header">
        <Link className="brand" to="/dang-nhap">
          <span className="brand-icon">
            <Icon name="pen" size={25} />
            <span>✦</span>
          </span>
          <span>
            Nét<span className="brand-coral">Xinh</span>
            <small>BÉ VUI HỌC VIẾT</small>
          </span>
        </Link>
        <span>
          Dành cho ba mẹ <Icon name="heart" size={16} />
        </span>
      </header>
      <main className="auth-layout">
        <section className="auth-story">
          <span className="eyebrow">NÉT CHỮ NHỎ, ƯỚC MƠ TO</span>
          <h1>
            Cùng con viết nên
            <br />
            <span>những điều thật xinh.</span>
          </h1>
          <p>
            Một không gian học tập dịu dàng, nơi mỗi cố gắng nhỏ của con đều
            được trân trọng.
          </p>
          <div className="auth-art">
            <HeroArtwork />
          </div>
          <div className="auth-benefits">
            <span>
              <Icon name="user" size={19} /> Hồ sơ riêng cho từng bé
            </span>
            <span>
              <Icon name="book" size={19} /> Nội dung tiếng Việt theo cấp học
            </span>
            <span>
              <Icon name="shield" size={19} /> Ba mẹ đồng hành cùng con
            </span>
          </div>
        </section>
        <section className="auth-form-panel panel">
          <span className="eyebrow">CHÀO MỪNG ĐẾN VỚI NÉTXINH</span>
          <h2>
            {register ? 'Bắt đầu hành trình cùng con' : 'Ba mẹ quay lại rồi!'}
          </h2>
          <p>
            {register
              ? 'Tạo tài khoản phụ huynh để chuẩn bị góc học tập cho bé.'
              : 'Đăng nhập để mở không gian học tập của gia đình.'}
          </p>
          <form className="account-form" onSubmit={submit}>
            {register && (
              <label>
                Tên hiển thị của ba mẹ
                <input
                  name="fullName"
                  autoComplete="name"
                  required
                  maxLength={100}
                  pattern=".*\S.*"
                  placeholder="Ba mẹ muốn Pip gọi là gì?"
                  disabled={busy}
                />
              </label>
            )}
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={255}
                placeholder="vidu@email.com"
                disabled={busy}
              />
            </label>
            <label>
              Mật khẩu
              <div className="password-field">
                <input
                  name="password"
                  aria-label="Mật khẩu"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  required
                  minLength={register ? 8 : 1}
                  maxLength={72}
                  placeholder={
                    register ? 'Ít nhất 8 ký tự' : 'Nhập mật khẩu của ba mẹ'
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
            </label>
            {register && (
              <label>
                Nhập lại mật khẩu
                <input
                  name="confirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={72}
                  placeholder="Nhập lại mật khẩu"
                  disabled={busy}
                />
              </label>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button" disabled={busy} type="submit">
              {busy
                ? 'Đang kết nối...'
                : register
                  ? 'Tạo tài khoản phụ huynh'
                  : 'Đăng nhập'}
              {busy ? (
                <span className="loading-spinner small" />
              ) : (
                <Icon name="arrow" size={20} />
              )}
            </button>
          </form>
          <p className="auth-switch">
            {register ? 'Ba mẹ đã có tài khoản? ' : 'Lần đầu đến NétXinh? '}
            <Link
              to={register ? '/dang-nhap' : '/dang-ky'}
              state={{ from: backTo }}
            >
              {register ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Link>
          </p>
          <div className="auth-note">
            <Icon name="leaf" size={20} />
            <p>
              Ba mẹ chỉ cần biệt danh khi tạo hồ sơ bé. Mình cùng bắt đầu thật
              nhẹ nhàng nhé!
            </p>
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        Mỗi em bé đều có nhịp học riêng. Cứ từ từ thôi nhé!{' '}
        <Icon name="heart" size={14} />
      </footer>
    </div>
  )
}
