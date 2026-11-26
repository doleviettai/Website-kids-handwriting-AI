import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { GradebookResponse } from '../../api/types'
import type { Subject } from '../../types'
import { gradeLabels, subjectLabels } from '../../data'
import { useResource } from '../../hooks/useResource'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { Icon } from '../../components/Icons'

const ratingShort: Record<string, string> = {
  HOAN_THANH_TOT: 'HTT',
  HOAN_THANH: 'HT',
  CAN_CO_GANG: 'CCG',
}

export function TeacherGradebookPage() {
  const { classroomId } = useParams()
  const [subject, setSubject] = useState<Subject | 'ALL'>('ALL')
  const query = subject === 'ALL' ? '' : `?subject=${subject}`
  const data = useResource<GradebookResponse>(
    classroomId ? `/teacher/classrooms/${classroomId}/gradebook${query}` : null,
    subject,
  )

  return (
    <div className="page-enter">
      <Link to={`/giao-vien/lop/${classroomId}`} className="back-link">
        ← Về trang lớp học
      </Link>

      <header className="section-heading page-title">
        <div>
          <span className="eyebrow">
            BẢNG ĐIỂM & ĐÁNH GIÁ THEO ĐỢT
            {data.data
              ? ` · ${gradeLabels[data.data.gradeLevel]} · ${data.data.schoolYear}`
              : ''}
          </span>
          <h1>
            {data.data ? `Bảng điểm ${data.data.classroomName}` : 'Bảng điểm lớp'}
          </h1>
          <p>
            Theo dõi điểm số, xếp loại và trạng thái nộp bài tập theo từng đợt
            cho từng học sinh.
          </p>
        </div>
        <div className="notification-filter-tabs">
          {(['ALL', 'TIENG_VIET', 'TOAN'] as const).map((s) => (
            <button
              key={s}
              type="button"
              className={subject === s ? 'primary-button' : 'soft-button'}
              onClick={() => setSubject(s)}
            >
              {s === 'ALL' ? 'Tất cả môn' : subjectLabels[s]}
            </button>
          ))}
        </div>
      </header>

      {data.loading ? (
        <Loading message="Đang tải bảng điểm lớp..." />
      ) : data.error ? (
        <ErrorPanel message={data.error} onRetry={data.reload} />
      ) : !data.data || data.data.students.length === 0 ? (
        <div className="empty-state panel">
          <p>Lớp chưa có học sinh nào để hiển thị bảng điểm.</p>
        </div>
      ) : (
        <section className="panel gradebook-wrap">
          <div className="gradebook-scroll">
            <table className="gradebook-table">
              <thead>
                <tr>
                  <th>Học sinh & Phụ huynh</th>
                  <th>TB điểm</th>
                  {data.data.batches.map((b) => (
                    <th key={b.batchId}>
                      <Link
                        to={
                          b.homework
                            ? `/giao-vien/bai-tap/${b.batchId}`
                            : `/giao-vien/dot-cham/${b.batchId}`
                        }
                        className="gradebook-col-link"
                      >
                        <small>{subjectLabels[b.subject]}</small>
                        <span>{b.title}</span>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.students.map((st) => (
                  <tr key={st.enrollmentId}>
                    <td>
                      <strong>{st.displayName}</strong>
                      <div className="gradebook-sub">
                        {st.parentName || (st.linkedParent ? 'Đã liên kết PH' : 'Chưa liên kết')}
                        {st.parentPhone ? ` · ${st.parentPhone}` : ''}
                      </div>
                    </td>
                    <td>
                      <strong>
                        {st.averageScore == null ? '—' : st.averageScore}
                      </strong>
                    </td>
                    {st.cells.map((cell) => (
                      <td
                        key={cell.batchId}
                        className={cell.needsAttention ? 'is-attention' : ''}
                      >
                        <div className="gradebook-cell">
                          <strong>
                            {cell.score != null
                              ? cell.score
                              : cell.rating
                                ? ratingShort[cell.rating]
                                : '—'}
                          </strong>
                          {cell.rating && cell.score != null && (
                            <small>{ratingShort[cell.rating]}</small>
                          )}
                          <span className="gradebook-cell-status">
                            {cell.sentToParentAt ? (
                              <>
                                <Icon name="check" size={12} /> Đã gửi
                              </>
                            ) : cell.scheduledSendAt ? (
                              'Hẹn gửi'
                            ) : cell.submitted ? (
                              `${cell.pageCount} trang`
                            ) : (
                              'Chưa nộp'
                            )}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
