export function Mascot({
  className = '',
  waving = false,
}: {
  className?: string
  waving?: boolean
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 190"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="90" cy="178" rx="51" ry="8" fill="#343c79" opacity=".08" />
      <path d="M53 117c-35 8-42 32-28 42 17 13 36-4 43-17" fill="#fb923c" />
      <path d="M25 159c-10-8-8-19 1-28l16 21Z" fill="#fff8ee" />
      <path d="M57 164c-4 17 19 20 24 5m18 0c5 15 28 12 24-5" fill="#fb923c" />
      <ellipse cx="91" cy="135" rx="38" ry="39" fill="#fb923c" />
      <ellipse cx="91" cy="142" rx="22" ry="26" fill="#fff8ee" />
      <path
        d={
          waving
            ? 'M58 126C30 123 31 89 42 91c11 2 8 20 21 18'
            : 'M59 126c-26 13-18 28-8 24l16-13'
        }
        fill="#fb923c"
      />
      <path d="M122 122c24 14 22 28 9 28l-17-16" fill="#fb923c" />
      <path
        d="M43 73 36 16q1-12 10-4l40 36m17 0 33-37q9-8 11 5l-3 57"
        fill="#fb923c"
      />
      <path d="m46 28 6 33 19-11Zm90 0-22 23 22 10Z" fill="#ffb7a6" />
      <path
        d="M41 73c0-39 104-39 104 0 0 35-25 53-52 53S41 108 41 73Z"
        fill="#fb923c"
      />
      <path
        d="M44 82c18-15 38 3 48 12 14-12 32-27 51-12-5 28-26 41-50 41S49 108 44 82Z"
        fill="#fff8ee"
      />
      <path
        d="M66 80q6-8 12 0m30 0q6-8 12 0"
        stroke="#343c79"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse cx="93" cy="96" rx="6" ry="4" fill="#343c79" />
      <path
        d="M93 100v6m-9 0q9 9 18 0"
        stroke="#343c79"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <ellipse cx="61" cy="93" rx="8" ry="5" fill="#ff6b6b" opacity=".35" />
      <ellipse cx="124" cy="93" rx="8" ry="5" fill="#ff6b6b" opacity=".35" />
      <path d="M58 114q33 17 68 0l-5 12q-27 13-58 0Z" fill="#a855f7" />
      <path d="m108 124 11 29 12-7-11-25" fill="#a855f7" />
    </svg>
  )
}
export function HeroArtwork() {
  return (
    <div
      className="hero-art"
      aria-label="Minh họa bạn cáo Pip vui học viết chữ"
    >
      <svg
        className="hero-art-scene"
        viewBox="0 0 480 290"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="267" cy="150" r="128" fill="white" opacity=".42" />
        <path
          d="M65 251q170-45 355-2"
          stroke="#cfcae3"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <g className="float-slow">
          <rect
            x="325"
            y="42"
            width="65"
            height="71"
            rx="17"
            transform="rotate(12 325 42)"
            fill="#ffd23f"
          />
          <text
            x="341"
            y="95"
            fill="#343c79"
            fontSize="47"
            fontWeight="900"
            fontFamily="Nunito"
          >
            B
          </text>
        </g>
        <g className="float-gentle">
          <rect
            x="63"
            y="57"
            width="64"
            height="68"
            rx="16"
            transform="rotate(-13 63 57)"
            fill="#ffb9b9"
          />
          <text
            x="83"
            y="102"
            fill="#b53c72"
            fontSize="49"
            fontWeight="900"
            fontFamily="Nunito"
          >
            a
          </text>
        </g>
        <path
          d="m304 12 4 10 11 1-8 7 2 11-10-6-10 5 3-11-7-8 11 1Z"
          fill="#a855f7"
          opacity=".55"
        />
        <path
          d="m399 144 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z"
          fill="#ff6b6b"
          opacity=".7"
        />
        <path
          d="M43 165h13m-6-6v12m311 49h13m-7-7v14"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="150" cy="32" r="5" fill="#34d399" />
        <circle cx="416" cy="72" r="4" fill="#a855f7" opacity=".5" />
        <g transform="rotate(-8 246 234)">
          <rect x="162" y="191" width="174" height="69" rx="8" fill="#cfcae3" />
          <rect x="157" y="184" width="174" height="69" rx="8" fill="white" />
          <path
            d="M173 204h142m-142 17h142m-142 17h142"
            stroke="#edf7ff"
            strokeWidth="2"
          />
          <text
            x="200"
            y="234"
            fill="#b8a5d2"
            fontSize="48"
            fontFamily="cursive"
            fontStyle="italic"
          >
            a a
          </text>
          <path d="M178 189v59" stroke="#ffb9b9" />
        </g>
        <g transform="rotate(28 327 166)">
          <rect x="318" y="112" width="18" height="99" rx="4" fill="#38bdf8" />
          <path d="m318 207 9 21 9-21" fill="#ffda70" />
          <path d="m324 220 3 8 3-8" fill="#343c79" />
          <path d="M323 122v75" stroke="white" strokeWidth="3" opacity=".5" />
          <rect x="318" y="111" width="18" height="13" rx="4" fill="#ffb9b9" />
        </g>
      </svg>
      <Mascot className="hero-fox" waving />
      <div className="hero-note">
        <span className="note-star">✦</span> Bé viết giỏi quá!
      </div>
    </div>
  )
}
export function LessonArt({ kind }: { kind: string }) {
  const left: Record<string, string> = {
    letters: 'a',
    numbers: '1',
    round: 'o',
    compound: 'ch',
    words: 'bé',
    sentence: 'Bé',
    'more-numbers': '6',
    'more-letters': 'b',
  }
  const right: Record<string, string> = {
    letters: 'ă',
    numbers: '2',
    round: 'ô',
    compound: 'nh',
    words: 'mẹ',
    sentence: 'yêu',
    'more-numbers': '9',
    'more-letters': 'đ',
  }
  const small = ['compound', 'words', 'sentence'].includes(kind)
  return (
    <svg
      className="lesson-art"
      viewBox="0 0 320 140"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="275" cy="18" r="53" fill="white" opacity=".32" />
      <circle cx="36" cy="131" r="38" fill="white" opacity=".27" />
      <path
        d="m42 33 3 7 8 1-6 5 1 8-7-4-6 4 1-8-5-5 8-1Z"
        fill="currentColor"
        opacity=".28"
      />
      <path
        d="M265 92h12m-6-6v12M67 96h9m-5-5v10"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".35"
        strokeLinecap="round"
      />
      {kind === 'strokes' ? (
        <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
          <path d="M115 98V40" />
          <path d="M150 98V40" strokeDasharray="2 12" />
          <path d="M190 43c-43 0-43 55 0 55" />
          <path d="M225 43c-36 0-36 55 0 55" strokeDasharray="2 12" />
        </g>
      ) : (
        <>
          <rect
            x="95"
            y="23"
            width="66"
            height="91"
            rx="13"
            fill="white"
            opacity=".8"
            transform="rotate(-9 95 23)"
          />
          <rect
            x="165"
            y="25"
            width="73"
            height="91"
            rx="13"
            fill="white"
            opacity=".9"
            transform="rotate(10 165 25)"
          />
          <text
            x="123"
            y="92"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Nunito"
            fontWeight="900"
            fontSize={small ? 37 : 62}
            transform="rotate(-9 123 75)"
          >
            {left[kind]}
          </text>
          <text
            x="194"
            y="99"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="Nunito"
            fontWeight="900"
            fontSize={small ? 34 : 58}
            opacity=".6"
            transform="rotate(10 194 75)"
          >
            {right[kind]}
          </text>
        </>
      )}
      <path d="m253 30 5 4-25 33-7 3 1-8Z" fill="#ffd23f" />
      <path d="m226 70 7-3-6-5Z" fill="#343c79" />
    </svg>
  )
}
