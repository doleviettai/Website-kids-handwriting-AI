import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth-context'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { Icon } from '../components/Icons'

export function SettingsPage() {
  const { user } = useAuth()
  const [muted, setMuted] = useLocalStorage('netxinh.muted.v1', false)
  const [paused, setPaused] = useLocalStorage('netxinh.motion-paused.v1', false)
  return (
    <div className="page-enter settings-page">
      <div className="section-heading page-title">
        <div>
          <span className="eyebrow">THÊM MỘT CHÚT RIÊNG CHO GIA ĐÌNH</span>
          <h1>Tài khoản & cài đặt</h1>
          <p>Thông tin của ba mẹ và tùy chọn trên thiết bị này.</p>
        </div>
      </div>
      <section className="panel account-details">
        <div className="settings-section-title">
          <Icon name="user" size={25} />
          <h2>Tài khoản đang đăng nhập</h2>
        </div>
        <dl>
          <div>
            <dt>Tên hiển thị</dt>
            <dd>{user?.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Vai trò</dt>
            <dd>{user?.role === 'ADMIN' ? 'Quản trị viên' : 'Phụ huynh'}</dd>
          </div>
        </dl>
        {user?.role === 'PARENT' && (
          <Link className="soft-button" to="/ho-so">
            Quản lý hồ sơ của các bé
            <Icon name="arrow" size={18} />
          </Link>
        )}
      </section>
      <section className="panel account-details">
        <div className="settings-section-title">
          <Icon name="settings" size={25} />
          <h2>Trải nghiệm trên thiết bị</h2>
        </div>
        <label className="preference-row">
          <span>
            <strong>Âm thanh</strong>
            <small>Chuẩn bị cho các hoạt động học có hướng dẫn phát âm.</small>
          </span>
          <input
            type="checkbox"
            checked={!muted}
            onChange={(e) => setMuted(!e.target.checked)}
          />
        </label>
        <label className="preference-row">
          <span>
            <strong>Chuyển động nhẹ</strong>
            <small>Bật hoặc tắt chuyển động của Pip và các minh họa.</small>
          </span>
          <input
            type="checkbox"
            checked={!paused}
            onChange={(e) => {
              setPaused(!e.target.checked)
              window.dispatchEvent(new Event('netxinh:preferences'))
            }}
          />
        </label>
      </section>
    </div>
  )
}
