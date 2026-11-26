import type { CSSProperties, ReactNode } from 'react'

const paths: Record<string, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  book: (
    <>
      <path d="M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Z" />
      <path d="M12 5v15M6 8h3m6 0h3M6 12h3m6 0h3" />
    </>
  ),
  pen: <path d="m16 3 5 5-12 12-6 1 1-6ZM13 6l5 5M4 15l5 5" />,
  trophy: (
    <path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a5 5 0 0 0 5 5m9-8h4v3a5 5 0 0 1-5 5M12 14v5m-5 2h10m-8-2h6" />
  ),
  chart: <path d="M4 3v18h17M8 16v-4m5 4V7m5 9v-7" />,
  settings: (
    <>
      <path d="m9 3-1 3-3 1-2 3 2 2-1 4 3 2h3l2 3 3-2 3-1 2-3-1-3 2-3-2-3-4-1-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  star: (
    <path d="m12 2 3.1 6.3L22 9.4l-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1.1Z" />
  ),
  flame: (
    <path d="M13 2s1 5-3 8c0-3-2-4-2-4S2 12 5 18a8 8 0 0 0 14-7c-1-4-4-6-6-9Zm-1 12s5 5 0 7c-5-2 0-7 0-7Z" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bell: <path d="M5 9a7 7 0 0 1 14 0v6l2 3H3l2-3Zm5 12h4" />,
  volume: (
    <path d="M11 4 6 8H3v8h3l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
  ),
  mute: <path d="M11 4 6 8H3v8h3l5 4Zm5 5 5 6m0-6-5 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="3" width="7" height="7" rx="2" />
      <rect x="3" y="14" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
    </>
  ),
  letter: <path d="m4 20 7-16h2l7 16M7 14h10" />,
  numbers: <path d="m3 6 3-2v15m-3 1h6m4-13c0-5 8-5 8 0 0 3-8 7-8 11v2h8" />,
  layers: <path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5" />,
  camera: (
    <>
      <path d="M3 6h4l2-3h6l2 3h4v15H3Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  upload: <path d="M12 16V3m-5 5 5-5 5 5M3 15v6h18v-6" />,
  undo: <path d="m8 4-5 5 5 5M3 9h11a7 7 0 0 1 0 14" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  play: <path d="m8 4 12 8-12 8Z" />,
  sparkles: (
    <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4M3 19v4m-2-2h4" />
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8a3 3 0 0 1 6 1c0 2-3 2-3 5m0 3v.1" />
    </>
  ),
  leaf: <path d="M20 3S2 0 3 13c1 10 16 10 17-10ZM5 19 15 9m-7 7v-5m0 5h5" />,
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  download: <path d="M12 3v13m-5-5 5 5 5-5M3 16v5h18v-5" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M8 14h3m2 0h3M8 18h3" />
    </>
  ),
}
export function Icon({
  name,
  size = 22,
  className = '',
  style,
}: {
  name: string
  size?: number
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name] ?? paths.sparkles}
    </svg>
  )
}
