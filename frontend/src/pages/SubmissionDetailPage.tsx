import { Link, useParams } from 'react-router-dom'
import { useResource } from '../hooks/useResource'
import type { SubmissionDetail } from '../api/types'
import { ErrorPanel, Loading } from '../components/Feedback'
import { SubmissionResult } from '../components/SubmissionResult'

export function SubmissionDetailPage() {
  const { submissionId } = useParams()
  const result = useResource<SubmissionDetail>(`/submissions/${submissionId}`)
  return (
    <div className="page-enter">
      <Link to="/" className="back-link">
        ← Về trang chính
      </Link>
      {result.loading ? (
        <Loading message="Đang tải bài viết..." />
      ) : result.error ? (
        <ErrorPanel message={result.error} onRetry={result.reload} />
      ) : (
        result.data && <SubmissionResult result={result.data} />
      )}
    </div>
  )
}
