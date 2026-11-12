'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { BotSettings, FullState, Tick } from '@/lib/trading-types'
import { connectEngine } from '@/lib/engine-socket'
import { playTradeOpen, playWin, playLoss } from '@/lib/alerts'
import { useToast } from '@/hooks/use-toast'
import { HomeTab, fmtMoney } from '@/components/trading/HomeTab'
import { BotTab } from '@/components/trading/BotTab'
import { TradesTab } from '@/components/trading/TradesTab'
import { SettingsTab } from '@/components/trading/SettingsTab'
import { Home, Bot as BotIcon, ListOrdered, Settings, Wifi, WifiOff } from 'lucide-react'

type Tab = 'home' | 'bot' | 'trades' | 'settings'

const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'خانه', icon: Home },
  { id: 'bot', label: 'بات', icon: BotIcon },
  { id: 'trades', label: 'معاملات', icon: ListOrdered },
  { id: 'settings', label: 'تنظیمات', icon: Settings },
]

type TradePhase = 'open' | 'win' | 'loss' | 'draw'

export default function App() {
  const [state, setState] = useState<FullState | null>(null)
  const [tick, setTick] = useState<Tick | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [tab, setTab] = useState<Tab>('home')
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<ReturnType<typeof connectEngine> | null>(null)
  const phasesRef = useRef<Map<string, TradePhase>>(new Map())
  const { toast } = useToast()

  useEffect(() => {
    const socket = connectEngine({
      onState: (s: FullState) => {
        setState(s)
        if (s.tick) setTick(s.tick)
      },
      onTick: (t: Tick) => setTick(t),
      onError: (m: string) => {
        toast({ title: 'خطا', description: m, variant: 'destructive' })
      },
    })
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', () => setConnected(false))
    socketRef.current = socket

    const clock = setInterval(() => setNow(Date.now()), 200)
    return () => {
      clearInterval(clock)
      socket.close()
      socketRef.current = null
    }
  }, [])

  const patch = useCallback((p: Partial<BotSettings>) => {
    socketRef.current?.emit('update-settings', p)
  }, [])

  const toggleBot = useCallback(() => {
    if (!state) return
    patch({ botRunning: !state.settings.botRunning })
  }, [state, patch])

  const resetAccount = useCallback(() => {
    socketRef.current?.emit('reset-account')
  }, [])

  const closeTrade = useCallback((id: string) => {
    socketRef.current?.emit('close-trade', id)
  }, [])

  const manualTrade = useCallback((d: 'BUY' | 'SELL') => {
    socketRef.current?.emit('manual-trade', d)
  }, [])

  // ─── trade lifecycle alerts: toast + sound + vibration ───
  useEffect(() => {
    if (!state) return
    const phases = phasesRef.current
    const sound = state.settings.soundEnabled
    for (const t of state.trades) {
      const before = phases.get(t.id)
      if (!before) {
        if (t.status === 'open') {
          // only announce trades that opened while we are watching (no history replay)
          if (Date.now() - t.openTime < 6000) {
            playTradeOpen(sound)
            toast({
              title: `${t.direction === 'BUY' ? 'خرید' : 'فروش'} XAUUSD باز شد`,
              description: `حجم: ${t.stake > 0 ? `$${t.stake}` : `${t.lots} لات`} • ورود: ${t.openPrice.toFixed(2)} • بستن در ${t.durationSec} ثانیه`,
            })
          }
          phases.set(t.id, 'open')
        } else {
          phases.set(t.id, t.result === 'WIN' ? 'win' : t.result === 'LOSS' ? 'loss' : 'draw')
        }
      } else if (before === 'open' && t.status === 'closed') {
        const win = t.result === 'WIN'
        const draw = t.result === 'DRAW'
        if (win) playWin(sound)
        else if (t.result === 'LOSS') playLoss(sound)
        toast({
          title: win ? 'برد! ✓' : draw ? 'خنثی' : 'باخت ✗',
          description: `${t.direction === 'BUY' ? 'خرید' : 'فروش'} XAUUSD — سود/زیان: ${fmtMoney(t.pnl ?? 0, true)}`,
        })
        phases.set(t.id, win ? 'win' : draw ? 'draw' : 'loss')
      }
    }
    if (phases.size > 100) {
      phasesRef.current = new Map([...phases.entries()].slice(-50))
    }
  }, [state, toast])

  if (!state) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[#f7d77e] to-[#f5b52a] text-2xl font-black text-[#171310] gold-glow">G</div>
        <div className="flex items-center gap-2 text-sm text-[#a89d8d]">
          {!connected && <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#f5b52a]" />}
          {connected ? 'در حال دریافت داده‌های بازار…' : 'در حال اتصال به موتور ترید…'}
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-stone-950/85 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-[#f7d77e] to-[#f5b52a] text-lg font-black text-[#171310]">G</div>
            <div>
              <h1 className="text-sm font-black leading-5">گلد بات <span className="text-[#f5b52a]">تریدر</span></h1>
              <p className="text-[10px] leading-4 text-[#a89d8d]">ربات هوشمند طلا • AI + MT5</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${state.settings.mode === 'mt5' ? 'bg-[#f5b52a]/15 text-[#f5b52a]' : 'bg-stone-500/15 text-stone-300'}`}>
              {state.settings.mode === 'mt5' ? 'MT5 واقعی' : 'حالت دمو'}
            </span>
            <span aria-label={connected ? 'متصل' : 'قطع'} className={connected ? 'text-[#35c98e]' : 'text-[#f4536b]'}>
              {connected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-3 py-3">
        {tab === 'home' && <HomeTab state={state} tick={tick} now={now} onManualTrade={manualTrade} />}
        {tab === 'bot' && <BotTab state={state} now={now} onToggleBot={toggleBot} onSetDuration={d => patch({ tradeDurationSec: d })} />}
        {tab === 'trades' && <TradesTab state={state} now={now} onCloseTrade={closeTrade} />}
        {tab === 'settings' && <SettingsTab state={state} onPatch={patch} onReset={resetAccount} />}
      </div>

      {/* Bottom nav — Android app style */}
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-border bg-stone-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md" aria-label="ناوبری اصلی">
        <div className="grid grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${active ? 'text-[#f5b52a]' : 'text-[#8d7b5e] active:text-stone-300'}`}
              >
                <span className={`relative rounded-xl px-4 py-1 ${active ? 'bg-[#f5b52a]/12' : ''}`}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                  {id === 'bot' && state.settings.botRunning && (
                    <span className="live-dot absolute -top-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#35c98e]" />
                  )}
                </span>
                <span className={`text-[10px] ${active ? 'font-bold' : ''}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </main>
  )
}
