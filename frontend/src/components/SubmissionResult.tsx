import { Link } from 'react-router-dom'
import type { SubmissionDetail } from '../api/types'
import { Icon } from './Icons'

export function SubmissionResult({ result }: { result: SubmissionDetail }) {
  const geometry = result.assessmentMethod === 'REFERENCE_GEOMETRY'
  const groups = result.segments.filter(
    (s) => s.strokeStart != null && s.strokeEnd != null,
  )
  const drawings = groups.length
    ? groups.map((s) => ({
        label: s.predicted || 'Chưa đọc rõ',
        strokes: result.strokes.slice(s.strokeStart!, s.strokeEnd!),
      }))
    : [{ label: result.predictedText, strokes: result.strokes ?? [] }]
  return (
    <section className="submission-result panel">
      <div className="result-heading">
        <div>
          <span className="eyebrow">
            KẾT QUẢ CỦA {result.nickname.toLocaleUpperCase('vi')}
          </span>
          <h2>
            {result.correct
              ? 'Bé đã viết đúng nội dung!'
              : 'Mình cùng xem lại nhé!'}
          </h2>
          <p>
            Yêu cầu: <strong>{result.expectedText}</strong>
          </p>
        </div>
        <div className="result-score">
          <strong>
            {result.totalScore}
            <small>/100</small>
          </strong>
          <span>{geometry ? 'So với mẫu tham khảo' : 'Độ đúng nội dung'}</span>
        </div>
      </div>
      <div className="result-stars" aria-label={`${result.stars} sao`}>
        {[1, 2, 3].map((i) => (
          <Icon
            key={i}
            name="star"
            size={30}
            className={i <= result.stars ? 'earned-star' : ''}
          />
        ))}
      </div>
      <div className="recognized-text">
        <span>Model đọc được</span>
        <strong>{result.predictedText || '(chưa đọc rõ)'}</strong>
        <small>
          Độ tin cậy nhận dạng: {Math.round((result.confidence ?? 0) * 100)}% ·
          Khớp nội dung: {Math.round((result.textAccuracy ?? 0) * 100)}%
        </small>
      </div>
      <div className="criterion-grid">
        {[
          { title: 'Hình dạng', score: result.shapeScore },
          { title: 'Tương đồng mẫu', score: result.similarityScore },
          ...(result.source === 'TOUCH'
            ? [
                { title: 'Hướng nét', score: result.directionScore },
                { title: 'Thứ tự nét', score: result.strokeOrderScore },
              ]
            : []),
        ].map((c) => (
          <div key={c.title}>
            <strong>{c.score == null ? '—' : `${c.score}/100`}</strong>
            <span>{c.title}</span>
          </div>
        ))}
      </div>
      <p className="assessment-note">
        {result.task === 'PARAGRAPH' &&
          'Bài từ/câu đối chiếu nội dung từ, bỏ qua hoa/thường và dấu câu. Kết quả nhận dạng gốc vẫn giữ nguyên. '}
        {geometry
          ? 'Các tiêu chí nét được đối chiếu bằng hình học với mẫu admin, chỉ dùng để tham khảo; đây chưa phải model chấm chất lượng chữ viết đã được hiệu chuẩn.'
          : 'Bài chưa có mẫu nét đối chiếu. Điểm hiện là mức khớp nội dung sau nhận dạng, không khẳng định chữ đẹp hay đúng thứ tự nét.'}{' '}
        Dấu “—” nghĩa là chưa đủ cơ sở đánh giá. Ba mẹ xem cùng con, nhất là khi
        độ tin cậy thấp.
      </p>
      {result.segments.length > 0 && (
        <div className="segment-results">
          <h3>Đối chiếu từng từ</h3>
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Từ cần viết</th>
                  <th>Đọc được</th>
                  <th>Độ đúng</th>
                </tr>
              </thead>
              <tbody>
                {result.segments.map((s) => (
                  <tr key={s.index}>
                    <td>{s.expected || '(từ thêm)'}</td>
                    <td>{s.predicted || '(thiếu/chưa rõ)'}</td>
                    <td>{s.score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="result-feedback">
        <Icon name="heart" size={23} />
        <p>{result.feedbackText}</p>
      </div>
      {result.errors.length > 0 && (
        <div className="result-findings">
          <h3>Điểm cần ba mẹ cùng bé xem lại</h3>
          {result.errors.map((error, index) => (
            <article key={index}>
              <strong>
                {error.nameVi}
                {error.segmentIndex != null
                  ? ` · Từ ${error.segmentIndex + 1}`
                  : ''}
                {error.strokeIndex != null
                  ? ` · Nét ${error.strokeIndex + 1}`
                  : ''}
              </strong>
              <p>{error.feedback}</p>
            </article>
          ))}
        </div>
      )}
      <details className="saved-strokes">
        <summary>Xem lại nét bút đã lưu</summary>
        <div className="stroke-groups">
          {drawings.map((g, i) => (
            <figure key={i}>
              <svg
                viewBox="0 0 900 420"
                preserveAspectRatio="none"
                style={{
                  aspectRatio:
                    result.task === 'SINGLE_CHAR' ? '1 / 1' : '5 / 2',
                  height: 'auto',
                  maxHeight: 'none',
                }}
                aria-label={`Nét viết ${g.label}`}
              >
                {g.strokes.map((stroke, j) =>
                  stroke.length === 1 ? (
                    <circle
                      key={j}
                      cx={stroke[0].x}
                      cy={stroke[0].y}
                      r={3}
                      fill="#9471b1"
                    />
                  ) : (
                    <polyline
                      key={j}
                      points={stroke.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#9471b1"
                      strokeWidth={5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ),
                )}
              </svg>
              <figcaption>{g.label}</figcaption>
            </figure>
          ))}
        </div>
      </details>
      <div className="submission-footer">
        <span>
          {new Date(result.createdAt).toLocaleString('vi-VN')} ·{' '}
          {result.modelVersion ?? 'Không rõ phiên bản'}
        </span>
        {result.lessonId && (
          <Link
            className="text-button"
            to={`/luyen-viet/${result.lessonId}?item=${result.itemId}`}
          >
            Luyện lại nội dung
            <Icon name="arrow" size={16} />
          </Link>
        )}
      </div>
    </section>
  )
}
