'use client'

/** Circular confidence gauge (0-100%) with gold gradient. */
export function ConfidenceRing({ value, size = 56, stroke = 5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, value))
  const color = pct >= 70 ? '#35c98e' : pct >= 45 ? '#f5b52a' : '#8d7b5e'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={`اطمینان ${pct} درصد`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2c251e" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#f5f0e8" fontSize={size * 0.26} fontWeight="700" className="tabular-nums">
        {pct}٪
      </text>
    </svg>
  )
}
