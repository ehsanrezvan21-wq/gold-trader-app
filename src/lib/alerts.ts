'use client'

// ─── Sound + haptic alerts (Web Audio, no assets needed) ───

let audioCtx: AudioContext | null = null

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!audioCtx) audioCtx = new AC()
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function tone(freq: number, startAt: number, dur: number, gain = 0.06, type: OscillatorType = 'sine') {
  const ac = ctx()
  if (!ac) return
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, ac.currentTime + startAt)
  g.gain.linearRampToValueAtTime(gain, ac.currentTime + startAt + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(ac.currentTime + startAt)
  osc.stop(ac.currentTime + startAt + dur + 0.05)
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(pattern) } catch { /* unsupported */ }
  }
}

/** Short click when a trade opens. */
export function playTradeOpen(enabled: boolean) {
  if (!enabled) return
  tone(660, 0, 0.09)
  tone(880, 0.09, 0.12)
  vibrate(40)
}

/** Rising two-tone on WIN. */
export function playWin(enabled: boolean) {
  if (!enabled) return
  tone(523, 0, 0.12)
  tone(784, 0.12, 0.16)
  tone(1047, 0.28, 0.22)
  vibrate([30, 60, 30])
}

/** Falling two-tone on LOSS. */
export function playLoss(enabled: boolean) {
  if (!enabled) return
  tone(392, 0, 0.16, 0.05, 'triangle')
  tone(262, 0.16, 0.24, 0.05, 'triangle')
  vibrate([60, 40, 60])
}
