'use client'

import { useState } from 'react'
import type { FullState, BotSettings } from '@/lib/trading-types'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ShieldAlert, Settings2, TriangleAlert, RefreshCcw, PlugZap } from 'lucide-react'

export function SettingsTab({
  state,
  onPatch,
  onReset,
}: {
  state: FullState
  onPatch: (p: Partial<BotSettings>) => void
  onReset: () => void
}) {
  const s = state.settings
  const [confirmReset, setConfirmReset] = useState(false)
  const isDemo = s.mode === 'demo'

  return (
    <div className="space-y-3">
      {/* Risk management */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="مدیریت ریسک">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold">مدیریت ریسک</h2>
        </div>

        <div className="mt-4 space-y-5">
          {!isDemo || true ? (
            <div>
              <div className="flex justify-between">
                <Label className="text-xs">حجم هر معامله (دلار)</Label>
                <span className="text-xs font-bold text-[#f5b52a] tabular-nums">${s.stake}</span>
              </div>
              <Slider
                className="mt-2"
                value={[s.stake]}
                min={1}
                max={100}
                step={1}
                onValueChange={([v]) => onPatch({ stake: v })}
                aria-label="حجم هر معامله"
              />
              <p className="mt-1 text-[10px] text-[#a89d8d]">در حالت MT5 واقعی، حجم با لات تنظیم می‌شود؛ این مقدار مبنای ریسک دمو است.</p>
            </div>
          ) : null}

          <div>
            <div className="flex justify-between">
              <Label className="text-xs">حداقل اطمینان برای ورود</Label>
              <span className="text-xs font-bold text-[#f5b52a] tabular-nums">{s.minConfidence}٪</span>
            </div>
            <Slider
              className="mt-2"
              value={[s.minConfidence]}
              min={30}
              max={95}
              step={1}
              onValueChange={([v]) => onPatch({ minConfidence: v })}
              aria-label="حداقل اطمینان"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">حداکثر معامله همزمان</Label>
              <Input
                className="mt-1.5 h-10 text-center tabular-nums"
                type="number"
                min={1}
                max={10}
                value={s.maxConcurrent}
                onChange={e => onPatch({ maxConcurrent: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })}
                aria-label="حداکثر معامله همزمان"
              />
            </div>
            <div>
              <Label className="text-xs">سقف ضرر روزانه ($)</Label>
              <Input
                className="mt-1.5 h-10 text-center tabular-nums"
                type="number"
                min={5}
                value={s.dailyLossCap}
                onChange={e => onPatch({ dailyLossCap: Math.max(5, Number(e.target.value) || 5) })}
                aria-label="سقف ضرر روزانه"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">ضریب برد (پرداخت)</Label>
              <Input
                className="mt-1.5 h-10 text-center tabular-nums"
                type="number"
                step="0.05"
                min={1}
                max={10}
                value={s.payout}
                onChange={e => onPatch({ payout: Math.max(1, Math.min(10, Number(e.target.value) || 1.85)) })}
                aria-label="ضریب برد"
              />
            </div>
            <div>
              <Label className="text-xs">بازه تحلیل AI (ثانیه)</Label>
              <Input
                className="mt-1.5 h-10 text-center tabular-nums"
                type="number"
                min={5}
                max={300}
                value={s.signalIntervalSec}
                onChange={e => onPatch({ signalIntervalSec: Math.max(5, Math.min(300, Number(e.target.value) || 12)) })}
                aria-label="بازه تحلیل"
              />
            </div>
          </div>

          {/* Emergency stop */}
          <button
            onClick={() => onPatch({ botRunning: false })}
            className="w-full rounded-xl border border-[#f4536b]/40 bg-[#f4536b]/10 py-3 text-sm font-black text-[#f4536b] active:bg-[#f4536b]/25"
          >
            توقف اضطراری بات
          </button>
        </div>
      </section>

      {/* MT5 connection */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="اتصال متاتریدر ۵">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-[#f5b52a]" />
            <h2 className="text-sm font-bold">اتصال MT5 واقعی</h2>
          </div>
          <StatusBadge status={state.mt5Status} />
        </div>

        <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 p-3">
          <div>
            <div className="text-xs font-bold">حالت حساب</div>
            <p className="text-[10px] text-[#a89d8d]">دمو = شبیه‌ساز داخلی، MT5 = حساب واقعی</p>
          </div>
          <div className="flex items-center gap-2" role="group" aria-label="انتخاب حالت">
            <button
              onClick={() => onPatch({ mode: 'demo' })}
              aria-pressed={isDemo}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${isDemo ? 'bg-[#f5b52a] text-[#171310]' : 'bg-[#26201a] text-stone-300'}`}
            >
              دمو
            </button>
            <button
              onClick={() => onPatch({ mode: 'mt5' })}
              aria-pressed={!isDemo}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!isDemo ? 'bg-[#f5b52a] text-[#171310]' : 'bg-[#26201a] text-stone-300'}`}
            >
              MT5
            </button>
          </div>
        </div>

        {!isDemo && (
          <div className="mt-3 space-y-3">
            {state.mt5Error && (
              <p className="rounded-lg bg-[#f4536b]/10 px-3 py-2 text-[11px] leading-5 text-[#f4536b]">{state.mt5Error}</p>
            )}
            {state.mt5 && (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 text-[11px]">
                <span className="text-[#a89d8d]">بروکر:</span><span className="font-bold">{state.mt5.broker}</span>
                <span className="text-[#a89d8d]">سرور:</span><span className="font-bold">{state.mt5.server}</span>
                <span className="text-[#a89d8d]">موجودی:</span><span className="font-bold tabular-nums">{state.mt5.balance.toFixed(2)}</span>
                <span className="text-[#a89d8d]">ارزش خالص:</span><span className="font-bold tabular-nums">{state.mt5.equity.toFixed(2)}</span>
              </div>
            )}
            <div>
              <Label className="text-xs">توکن MetaApi (Personal Token)</Label>
              <Input
                className="mt-1.5 h-10 font-mono text-xs"
                type="password"
                dir="ltr"
                placeholder="eyJhbGciOiJSUzI1NiIs..."
                value={s.metaapiToken}
                onChange={e => onPatch({ metaapiToken: e.target.value })}
                aria-label="توکن متا اپی آی"
              />
            </div>
            <div>
              <Label className="text-xs">شناسه حساب MT5 در MetaApi</Label>
              <Input
                className="mt-1.5 h-10 font-mono text-xs"
                dir="ltr"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={s.metaapiAccountId}
                onChange={e => onPatch({ metaapiAccountId: e.target.value })}
                aria-label="شناسه حساب"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">منطقه سرور</Label>
                <Select value={s.metaapiRegion} onValueChange={v => onPatch({ metaapiRegion: v })}>
                  <SelectTrigger className="mt-1.5 h-10 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['new-york', 'london', 'moscow', 'singapore', 'sydney'].map(r => (
                      <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">حجم سفارش (لات)</Label>
                <Input
                  className="mt-1.5 h-10 text-center font-mono text-xs tabular-nums"
                  dir="ltr"
                  type="number"
                  step="0.01"
                  min={0.01}
                  max={10}
                  value={s.mt5Lots}
                  onChange={e => onPatch({ mt5Lots: Math.max(0.01, Math.min(10, Number(e.target.value) || 0.01)) })}
                  aria-label="حجم لات"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">حد ضرر (پیپ)</Label>
                <Input
                  className="mt-1.5 h-10 text-center tabular-nums"
                  type="number"
                  min={5}
                  max={500}
                  value={s.slPips}
                  onChange={e => onPatch({ slPips: Math.max(5, Math.min(500, Number(e.target.value) || 30)) })}
                  aria-label="حد ضرر"
                />
              </div>
              <div>
                <Label className="text-xs">حد سود (پیپ)</Label>
                <Input
                  className="mt-1.5 h-10 text-center tabular-nums"
                  type="number"
                  min={5}
                  max={1000}
                  value={s.tpPips}
                  onChange={e => onPatch({ tpPips: Math.max(5, Math.min(1000, Number(e.target.value) || 60)) })}
                  aria-label="حد سود"
                />
              </div>
            </div>
            <p className="text-[10px] leading-5 text-[#a89d8d]">
              برای اتصال واقعی: در سایت metaapi.cloud حساب رایگان بسازید، توکن شخصی و شناسه حساب MT5 خود را اینجا وارد کنید و حساب را در پنل MetaApi مستقر (deploy) کنید.
            </p>
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-border bg-card p-4" aria-label="بخش خطر">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-[#f4536b]" />
          <h2 className="text-sm font-bold">بازنشانی</h2>
        </div>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-black/30 py-3 text-xs font-bold text-stone-300 active:bg-black/50"
          >
            <RefreshCcw className="h-3.5 w-3.5" /> ریست حساب دمو و آمار
          </button>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmReset(false)} className="rounded-xl bg-[#26201a] py-3 text-xs font-bold text-stone-300">انصراف</button>
            <button
              onClick={() => { onReset(); setConfirmReset(false) }}
              className="rounded-xl bg-[#f4536b] py-3 text-xs font-black text-white active:bg-[#d93650]"
            >
              بله، پاک کن
            </button>
          </div>
        )}
      </section>

      {/* Disclaimer */}
      <section className="rounded-2xl border border-[#f5b52a]/20 bg-[#f5b52a]/5 p-4" aria-label="هشدار ریسک">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#f5b52a]" />
          <h2 className="text-sm font-bold text-[#f5b52a]">هشدار ریسک</h2>
        </div>
        <p className="mt-2 text-[11px] leading-6 text-[#c9bda9]">
          معامله در بازار طلا و فارکس با ریسک بالای از دست دادن سرمایه همراه است. عملکرد گذشته هیچ تضمینی برای آینده نیست. این برنامه فقط ابزار است و مسئولیت هر معامله با خود شماست. قبل از اتصال حساب واقعی، ابتدا با حساب دمو تمرین کنید.
        </p>
      </section>
    </div>
  )
}

function StatusBadge({ status }: { status: FullState['mt5Status'] }) {
  if (status === 'connected') return <span className="rounded-md bg-[#35c98e]/15 px-2 py-0.5 text-[10px] font-bold text-[#35c98e]">متصل</span>
  if (status === 'connecting') return <span className="rounded-md bg-[#f5b52a]/15 px-2 py-0.5 text-[10px] font-bold text-[#f5b52a]">در حال اتصال…</span>
  if (status === 'error') return <span className="rounded-md bg-[#f4536b]/15 px-2 py-0.5 text-[10px] font-bold text-[#f4536b]">خطا</span>
  return <span className="rounded-md bg-stone-500/15 px-2 py-0.5 text-[10px] font-bold text-stone-400">غیرفعال</span>
}
