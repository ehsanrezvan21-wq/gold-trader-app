'use client'

import { useEffect, useRef } from 'react'
import type { Candle } from '@/lib/trading-types'

const UP = '#35c98e'
const DOWN = '#f4536b'
const GRID = '#2c251e'
const TEXT = '#8d7b5e'

/** Lightweight canvas candlestick chart with live last-price line. */
export function CandleChart({ candles, height = 150 }: { candles: Candle[]; height?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const data = candles.slice(-44)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const cssW = canvas.clientWidth || 320
    const cssH = height
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    if (data.length < 2) {
      ctx.fillStyle = TEXT
      ctx.font = '12px Vazirmatn, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('در حال دریافت داده‌ها…', cssW / 2, cssH / 2)
      return
    }

    const padRight = 52 // price axis
    const plotW = cssW - padRight
    const highs = data.map(c => c.h)
    const lows = data.map(c => c.l)
    const last = data[data.length - 1].c
    // include last tick price in range so the price line stays visible
    let max = Math.max(...highs, last)
    let min = Math.min(...lows, last)
    const pad = (max - min) * 0.08 || 0.5
    max += pad
    min -= pad
    const range = max - min || 1

    const y = (v: number) => 8 + (1 - (v - min) / range) * (cssH - 24)
    const cw = plotW / data.length
    const bodyW = Math.max(2, Math.min(9, cw * 0.62))

    // grid
    ctx.strokeStyle = GRID
    ctx.lineWidth = 1
    ctx.setLineDash([3, 6])
    ;[0.22, 0.5, 0.78].forEach(f => {
      const gy = 8 + f * (cssH - 24)
      ctx.beginPath()
      ctx.moveTo(0, gy)
      ctx.lineTo(plotW, gy)
      ctx.stroke()
    })
    ctx.setLineDash([])

    // candles
    data.forEach((c, i) => {
      const x = plotW - (data.length - i) * cw + cw / 2
      const up = c.c >= c.o
      const color = up ? UP : DOWN
      // wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y(c.h))
      ctx.lineTo(x, y(c.l))
      ctx.stroke()
      // body
      const yO = y(c.o)
      const yC = y(c.c)
      const top = Math.min(yO, yC)
      const h = Math.max(1.5, Math.abs(yC - yO))
      ctx.fillStyle = color
      ctx.fillRect(x - bodyW / 2, top, bodyW, h)
    })

    // last price dashed line + label
    const ly = y(last)
    const lastUp = data[data.length - 1].c >= data[data.length - 1].o
    ctx.strokeStyle = lastUp ? UP : DOWN
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(0, ly)
    ctx.lineTo(plotW, ly)
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = lastUp ? UP : DOWN
    const label = last.toFixed(2)
    ctx.font = 'bold 10px Vazirmatn, sans-serif'
    const tw = ctx.measureText(label).width
    ctx.fillRect(plotW + 2, ly - 8, Math.max(tw + 8, 44), 16)
    ctx.fillStyle = '#171310'
    ctx.textAlign = 'left'
    ctx.fillText(label, plotW + 6, ly + 3.5)
  }, [data, height, data.length, data[data.length - 1]?.c, data[data.length - 1]?.o, data[0]?.t])

  return (
    <canvas
      ref={ref}
      style={{ height, width: '100%' }}
      className="select-none"
      role="img"
      aria-label="نمودار کندل‌استیک قیمت طلا"
    />
  )
}
