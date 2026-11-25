import type { Recognition } from '../api/types'

export function RecognitionPreview({
  data,
  loading,
  error,
  compound = false,
}: {
  data: Recognition | null
  loading: boolean
  error: string | null
  compound?: boolean
}) {
  return (
    <section className="recognition-preview" aria-live="polite">
      <span className="eyebrow">NHẬN DẠNG THỬ · CHƯA LƯU BÀI</span>
      {loading ? (
        <p role="status">Máy đang đọc nét bút...</p>
      ) : error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <strong className="preview-prediction">
            {data.text || '(chưa đọc rõ)'}
          </strong>
          <p>
            Độ tin cậy {Math.round(data.confidence * 100)}%
            {data.uncertain ? ' · Cần ba mẹ xem lại' : ''}
          </p>
          {data.chars.length > 0 && (
            <div className="character-support">
              {data.chars.map((c, i) => (
                <span
                  key={i}
                  className={(c.confidence ?? 0) < 0.5 ? 'low-support' : ''}
                  title={
                    c.confidence == null
                      ? ''
                      : `${Math.round(c.confidence * 100)}%`
                  }
                >
                  {c.text}
                </span>
              ))}
            </div>
          )}
          {data.candidates.length > 1 && (
            <details>
              <summary>Các khả năng khác</summary>
              <ul>
                {data.candidates
                  .filter((c) => c.text !== data.text)
                  .map((c, i) => (
                    <li key={i}>
                      {c.text}
                      {c.confidence == null
                        ? ''
                        : ` · ${Math.round(c.confidence * 100)}%`}
                    </li>
                  ))}
              </ul>
            </details>
          )}
          {data.suggestedText && (
            <p className="language-suggestion">
              Gợi ý từ điển: <strong>{data.suggestedText}</strong>. Kết quả nét
              viết vẫn giữ là “{data.text}”.
            </p>
          )}
          {compound && data.preview?.startsWith('data:image/png;base64,') && (
            <details>
              <summary>Ảnh thực tế model nhìn thấy</summary>
              <img
                src={data.preview}
                alt="Ảnh nét viết sau tiền xử lý của model chữ ghép"
                width={192}
                height={64}
              />
            </details>
          )}
        </>
      ) : (
        <p>Viết xong rồi bấm “Nhận dạng thử” để xem máy đọc được gì.</p>
      )}
    </section>
  )
}
