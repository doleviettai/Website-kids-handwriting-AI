import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { WorkspaceProvider } from './context/WorkspaceProvider'
import { useAuth } from './context/auth-context'
import { useWorkspace } from './context/workspace-context'
import { Icon } from './components/Icons'
import { Mascot } from './components/Artwork'
import { ErrorPanel, Loading } from './components/Feedback'
import { Modal } from './components/Modal'
import { AuthPage } from './pages/AuthPage'
import { StudentsPage } from './pages/StudentsPage'
import { DashboardPage } from './pages/DashboardPage'
import { LessonsPage, LessonDetailPage } from './pages/LessonsPage'
import { AchievementsPage, JourneyPage } from './pages/JourneyPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'
import { AdminLessonsPage } from './pages/admin/AdminLessonsPage'
import { AdminItemsPage } from './pages/admin/AdminItemsPage'
import { AdminErrorsPage } from './pages/admin/AdminErrorsPage'
import { PracticePage } from './pages/PracticePage'
import { SubmissionDetailPage } from './pages/SubmissionDetailPage'
import { AdminReviewsPage } from './pages/admin/AdminReviewsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { PlanPage } from './pages/PlanPage'
import { TeacherClassesPage } from './pages/teacher/TeacherClassesPage'
import { TeacherClassroomPage } from './pages/teacher/TeacherClassroomPage'
import { TeacherBatchPage } from './pages/teacher/TeacherBatchPage'
import { TeacherHomeworkPage } from './pages/teacher/TeacherHomeworkPage'
import { TeacherGradebookPage } from './pages/teacher/TeacherGradebookPage'
import { ParentClassroomPage } from './pages/ParentClassroomPage'
import { NotificationBell } from './components/NotificationBell'
import { NotificationContext } from './context/notification-context'
import { useNotifications } from './hooks/useNotifications'
import { gradeLabels } from './data'
import './App.css'
import './ConnectedApp.css'

function ProtectedWorkspace() {
  const auth = useAuth(),
    location = useLocation()
  if (auth.loading)
    return <Loading message="Đang mở tài khoản của gia đình..." />
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
  if (!auth.user)
    return (
      <Navigate
        to="/dang-nhap"
        state={{ from: location.pathname + location.search }}
        replace
      />
    )
  return (
    <WorkspaceProvider key={auth.user.id}>
      <Shell />
    </WorkspaceProvider>
  )
}

function RolePage({
  role,
  children,
}: {
  role: 'PARENT' | 'TEACHER' | 'ADMIN'
  children: ReactNode
}) {
  const { user } = useAuth()
  const label =
    role === 'ADMIN'
      ? 'quản trị viên'
      : role === 'TEACHER'
        ? 'giáo viên chủ nhiệm'
        : 'phụ huynh'
  if (user?.role !== role)
    return (
      <div className="empty-state panel">
        <Icon name="shield" size={42} />
        <h2>Trang này dành cho {label}</h2>
        <Link className="soft-button" to="/">
          Về không gian của bạn
          <Icon name="arrow" size={18} />
        </Link>
      </div>
    )
  return children
}

function HomeRoute() {
  const role = useAuth().user?.role
  if (role === 'ADMIN') return <Navigate to="/quan-tri" replace />
  if (role === 'TEACHER') return <Navigate to="/giao-vien" replace />
  return <DashboardPage />
}
function HistoryRoute({ parent = false }: { parent?: boolean }) {
  const { selected } = useWorkspace()
  return <JourneyPage key={selected?.id ?? 'empty'} parent={parent} />
}
function LegacyPracticeRoute() {
  const { lessonId } = useParams()
  return (
    <Navigate to={lessonId ? `/bai-hoc/${lessonId}` : '/bai-hoc'} replace />
  )
}
function NotFound() {
  return (
    <div className="empty-state not-found">
      <Mascot />
      <h1>Pip chưa tìm thấy trang này</h1>
      <p>Mình quay về góc học tập nhé!</p>
      <Link className="primary-button" to="/">
        Về trang chính
        <Icon name="arrow" size={18} />
      </Link>
    </div>
  )
}

function Shell() {
  const { pathname } = useLocation(),
    auth = useAuth()
  const { students, selected, choose } = useWorkspace()
  const notificationState = useNotifications(Boolean(auth.user), pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [paused, setPaused] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem('netxinh.motion-paused.v1') ?? 'false',
      ) as boolean
    } catch {
      return false
    }
  })
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  useEffect(() => {
    const sync = () => {
      try {
        setPaused(
          JSON.parse(
            localStorage.getItem('netxinh.motion-paused.v1') ?? 'false',
          ),
        )
      } catch {
        /* Keep current preference. */
      }
    }
    window.addEventListener('netxinh:preferences', sync)
    return () => window.removeEventListener('netxinh:preferences', sync)
  }, [])
  const admin = auth.user?.role === 'ADMIN'
  const teacher = auth.user?.role === 'TEACHER'
  const links = admin
    ? [
        {
          to: '/quan-tri',
          icon: 'chart',
          label: 'Tổng quan quản trị',
          end: true,
        },
        {
          to: '/quan-tri/bai-hoc',
          icon: 'book',
          label: 'Quản lý bài học',
          end: false,
        },
        {
          to: '/quan-tri/noi-dung',
          icon: 'pen',
          label: 'Nội dung & mẫu nét',
          end: false,
        },
        {
          to: '/quan-tri/loai-loi',
          icon: 'heart',
          label: 'Loại lỗi & phản hồi',
          end: false,
        },
        {
          to: '/quan-tri/bai-viet',
          icon: 'chart',
          label: 'Bài viết & thông báo',
          end: false,
        },
        {
          to: '/bai-hoc',
          icon: 'book',
          label: 'Thư viện nội dung',
          end: false,
        },
      ]
    : teacher
      ? [
          {
            to: '/giao-vien',
            icon: 'user',
            label: 'Lớp học của cô',
            end: false,
          },
          {
            to: '/thong-bao',
            icon: 'bell',
            label: 'Thông báo',
            end: false,
          },
          {
            to: '/bai-hoc',
            icon: 'book',
            label: 'Thư viện nội dung',
            end: false,
          },
        ]
      : [
        { to: '/', icon: 'home', label: 'Góc học tập', end: true },
        { to: '/bai-hoc', icon: 'book', label: 'Bài học của bé', end: false },
        {
          to: '/luyen-tap/chu-don',
          icon: 'pen',
          label: 'Góc luyện viết',
          end: false,
        },
        {
          to: '/ke-hoach',
          icon: 'calendar',
          label: 'Kế hoạch luyện tập',
          end: false,
        },
        {
          to: '/lop-hoc',
          icon: 'layers',
          label: 'Lớp học & Bài tập',
          end: false,
        },
        { to: '/ho-so', icon: 'user', label: 'Hồ sơ các bé', end: false },
        {
          to: '/thanh-tich',
          icon: 'trophy',
          label: 'Vườn thành tích',
          end: false,
        },
        {
          to: '/tien-do',
          icon: 'chart',
          label: 'Hành trình của bé',
          end: false,
        },
      ]
  async function signOut() {
    setSigningOut(true)
    try {
      await auth.logout()
    } catch {
      /* Local session is cleared even when offline. */
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <NotificationContext.Provider value={notificationState}>
      <div className={`app-shell ${paused ? 'motion-paused' : ''}`}>
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      {menuOpen && (
        <button
          className="sidebar-overlay"
          aria-label="Đóng menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link to="/" className="brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">
            <Icon name="pen" size={25} />
            <span>✦</span>
          </span>
          <span>
            Nét<span className="brand-coral">Xinh</span>
            <small>BÉ VUI HỌC VIẾT</small>
          </span>
        </Link>
        <div className="sidebar-profile">
          <div className="avatar">
            <Mascot />
          </div>
          <div>
            <strong>
              {admin
                ? 'Quản trị viên'
                : teacher
                  ? auth.user?.fullName || 'Giáo viên'
                  : selected
                    ? `Bé ${selected.nickname}`
                    : 'Gia đình của bé'}
            </strong>
            <span>
              {admin
                ? 'NétXinh'
                : teacher
                  ? 'Giáo viên chủ nhiệm'
                  : selected
                    ? gradeLabels[selected.gradeLevel]
                    : 'Chưa chọn hồ sơ'}
            </span>
          </div>
          {!admin && !teacher && (
            <Link
              to="/ho-so"
              className="profile-edit"
              aria-label="Chọn hồ sơ bé"
            >
              <Icon name="down" size={15} />
            </Link>
          )}
        </div>
        <span className="nav-label">
          {admin
            ? 'QUẢN LÝ HỆ THỐNG'
            : teacher
              ? 'QUẢN LÝ LỚP HỌC'
              : 'THẾ GIỚI CỦA BÉ'}
        </span>
        <nav className="main-nav" aria-label="Điều hướng chính">
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
            >
              <Icon name={item.icon} size={21} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <Mascot className="sidebar-mascot" />
          <span className="sidebar-note-sparkle">✦</span>
          <h3>
            Mỗi nét chữ,
            <br />
            một niềm vui!
          </h3>
          <p>
            Pip luôn ở đây
            <br />
            đồng hành cùng bé.
          </p>
          <button onClick={() => setHelpOpen(true)}>
            Làm quen với Pip
            <Icon name="arrow" size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          {!admin && !teacher && (
            <NavLink to="/phu-huynh" onClick={() => setMenuOpen(false)}>
              <Icon name="heart" size={20} /> Góc ba mẹ
              <Icon name="chevron" size={14} />
            </NavLink>
          )}
          <NavLink to="/cai-dat" onClick={() => setMenuOpen(false)}>
            <Icon name="settings" size={20} /> Tài khoản & cài đặt
          </NavLink>
          <button
            className="sign-out"
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <Icon name="arrow" className="rotate-back" size={20} />
            {signingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
          <div className="sidebar-footer">
            <span>NétXinh © {new Date().getFullYear()}</span>
            <button
              onClick={() => {
                setPaused(!paused)
                try {
                  localStorage.setItem(
                    'netxinh.motion-paused.v1',
                    JSON.stringify(!paused),
                  )
                } catch {
                  /* Use memory. */
                }
              }}
            >
              {paused ? 'Bật chuyển động' : 'Dừng chuyển động'}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="topbar-breadcrumb">
              {admin
                ? 'Quản trị'
                : teacher
                  ? 'Giáo viên chủ nhiệm'
                  : 'Không gian gia đình'}
              <Icon name="chevron" size={13} />
              <strong>{auth.user?.fullName || 'NétXinh'}</strong>
            </span>
          </div>
          <div className="topbar-actions">
            {!admin && !teacher && (students.data?.length ?? 0) > 0 && (
              <label className="header-student-select">
                <Icon name="user" size={17} />
                <select
                  value={selected?.id ?? ''}
                  aria-label="Chọn hồ sơ bé"
                  onChange={(event) => choose(Number(event.target.value))}
                >
                  {students.data?.map((student) => (
                    <option key={student.id} value={student.id}>
                      Bé {student.nickname}
                    </option>
                  ))}
                </select>
                <Icon name="down" size={13} />
              </label>
            )}
            <button
              className="icon-button"
              onClick={() => setHelpOpen(true)}
              aria-label="Hướng dẫn sử dụng"
            >
              <Icon name="help" size={21} />
            </button>
            <NotificationBell />
            <span className="topbar-divider" />
            <Link
              to="/cai-dat"
              className="topbar-profile"
              aria-label="Mở tài khoản"
            >
              <div className="avatar small">
                <Mascot />
              </div>
              <strong>
                {admin ? 'Admin' : teacher ? 'Giáo viên' : 'Ba mẹ'}
              </strong>
            </Link>
          </div>
        </header>
        <main id="main-content" className="main-content connected-content">
          <Outlet />
        </main>
      </div>
      {helpOpen && (
        <Modal
          title="Chào gia đình, mình là Pip!"
          onClose={() => setHelpOpen(false)}
        >
          <div className="help-intro">
            <Mascot waving />
            <p>Pip sẽ đồng hành cùng bé trên hành trình khám phá chữ và số.</p>
          </div>
          <ol className="help-steps">
            <li>
              Ba mẹ vào <strong>Hồ sơ các bé</strong> để tạo hoặc chọn hồ sơ.
            </li>
            <li>
              Vào <strong>Bài học của bé</strong>, chọn bài và xem các nội dung.
            </li>
            <li>
              Ghé <strong>Hành trình của bé</strong> để xem hoạt động đã được
              lưu trong hồ sơ.
            </li>
          </ol>
          <p className="dialog-intro">
            Mở một bài học rồi chọn “Bé bắt đầu luyện viết”. Với từ/câu, bé viết
            từng từ rồi gửi cả bài. Ba mẹ xem lịch sử và thông báo để cùng con
            kiểm tra kết quả nhận dạng.
          </p>
          <button className="primary-button" onClick={() => setHelpOpen(false)}>
            Mình hiểu rồi, Pip ơi!
            <Icon name="heart" size={18} />
          </button>
        </Modal>
      )}
      </div>
    </NotificationContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/dang-nhap" element={<AuthPage key="login" />} />
          <Route
            path="/dang-ky"
            element={<AuthPage key="register" register />}
          />
          <Route element={<ProtectedWorkspace />}>
            <Route path="/" element={<HomeRoute />} />
            <Route
              path="/ho-so"
              element={
                <RolePage role="PARENT">
                  <StudentsPage />
                </RolePage>
              }
            />
            <Route path="/bai-hoc" element={<LessonsPage />} />
            <Route path="/bai-hoc/:lessonId" element={<LessonDetailPage />} />
            <Route path="/luyen-viet" element={<LegacyPracticeRoute />} />
            <Route
              path="/luyen-viet/:lessonId"
              element={
                <RolePage role="PARENT">
                  <PracticePage />
                </RolePage>
              }
            />
            <Route
              path="/luyen-tap/:practiceKind"
              element={
                <RolePage role="PARENT">
                  <PracticePage />
                </RolePage>
              }
            />
            <Route
              path="/bai-viet/:submissionId"
              element={<SubmissionDetailPage />}
            />
            <Route
              path="/quan-tri/bai-viet"
              element={
                <RolePage role="ADMIN">
                  <AdminReviewsPage />
                </RolePage>
              }
            />
            <Route
              path="/thanh-tich"
              element={
                <RolePage role="PARENT">
                  <AchievementsPage />
                </RolePage>
              }
            />
            <Route
              path="/tien-do"
              element={
                <RolePage role="PARENT">
                  <HistoryRoute />
                </RolePage>
              }
            />
            <Route
              path="/phu-huynh"
              element={
                <RolePage role="PARENT">
                  <HistoryRoute parent />
                </RolePage>
              }
            />
            <Route
              path="/quan-tri"
              element={
                <RolePage role="ADMIN">
                  <AdminPage />
                </RolePage>
              }
            />
            <Route path="/cai-dat" element={<SettingsPage />} />
            <Route path="/thong-bao" element={<NotificationsPage />} />
            <Route
              path="/ke-hoach"
              element={
                <RolePage role="PARENT">
                  <PlanPage />
                </RolePage>
              }
            />
            <Route
              path="/lop-hoc"
              element={
                <RolePage role="PARENT">
                  <ParentClassroomPage />
                </RolePage>
              }
            />
            <Route
              path="/giao-vien"
              element={
                <RolePage role="TEACHER">
                  <TeacherClassesPage />
                </RolePage>
              }
            />
            <Route
              path="/giao-vien/lop/:classroomId"
              element={
                <RolePage role="TEACHER">
                  <TeacherClassroomPage />
                </RolePage>
              }
            />
            <Route
              path="/giao-vien/lop/:classroomId/bang-diem"
              element={
                <RolePage role="TEACHER">
                  <TeacherGradebookPage />
                </RolePage>
              }
            />
            <Route
              path="/giao-vien/bai-tap/:batchId"
              element={
                <RolePage role="TEACHER">
                  <TeacherHomeworkPage />
                </RolePage>
              }
            />
            <Route
              path="/giao-vien/dot-cham/:batchId"
              element={
                <RolePage role="TEACHER">
                  <TeacherBatchPage />
                </RolePage>
              }
            />
            <Route
              path="/quan-tri/bai-hoc"
              element={
                <RolePage role="ADMIN">
                  <AdminLessonsPage />
                </RolePage>
              }
            />
            <Route
              path="/quan-tri/noi-dung"
              element={
                <RolePage role="ADMIN">
                  <AdminItemsPage />
                </RolePage>
              }
            />
            <Route
              path="/quan-tri/loai-loi"
              element={
                <RolePage role="ADMIN">
                  <AdminErrorsPage />
                </RolePage>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
