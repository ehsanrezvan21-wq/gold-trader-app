'use client'

import type { Candle } from '@/lib/trading-types'

export function Sparkline({ candles, height = 120 }: { candles: Candle[]; height?: number }) {
  const data = candles.slice(-84)
  if (data.length < 2) {
    return <div style={{ height }} className="flex items-center justify-center text-xs text-muted-foreground">در حال دریافت داده‌ها…</div>
  }
  const W = 320
  const H = height
  const values = data.map(c => c.c)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const up = values[values.length - 1] >= values[0]

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W
    const y = H - 8 - ((v - min) / range) * (H - 22)
    return [x, y] as const
  })
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const last = pts[pts.length - 1]
  const stroke = up ? '#35c98e' : '#f4536b'
  const fillTop = up ? 'rgba(53,201,142,0.22)' : 'rgba(244,83,107,0.22)'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" preserveAspectRatio="none" role="img" aria-label="نمودار قیمت طلا">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(f => (
        <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#2c251e" strokeDasharray="3 6" strokeWidth="1" />
      ))}
      <polygon points={area} fill="url(#sparkfill)" />
      <polyline points={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="4" fill={stroke}>
        <animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}
