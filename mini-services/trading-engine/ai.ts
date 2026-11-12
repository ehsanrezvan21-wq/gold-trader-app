// ─── AI analyst: GLM model reads market snapshot & returns a trading verdict ───
import type { Candle } from './types'
import { computeIndicators, symbolConfig } from './market'

export interface AIVerdict {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reason: string
}

/** Recent account performance, fed back to the AI so it adapts to its own track record. */
export interface RecentContext {
  wins: number
  losses: number
  /** current streak: +n wins / -n losses */
  streak: number
}

let zaiInstance: any = null
async function getZAI() {
  if (!zaiInstance) {
    const mod = await import('z-ai-web-dev-sdk')
    const ZAI = (mod as any).default ?? mod
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}

const SYSTEM_PROMPT = (symbol: string, fa: string) => `تو یک تحلیل‌گر حرفه‌ای معاملات ${fa} (${symbol}) هستی که برای یک ربات معامله‌گر خودکار حالت توربو کار می‌کنی.
بر اساس داده‌های کندل‌ها و اندیکاتورهای تکنیکال، جهت احتمالی حرکت کوتاه‌مدت (۳۰ تا ۶۰ ثانیه آینده) را پیش‌بینی کن.

قوانین:
- فقط با JSON پاسخ بده، بدون هیچ متن اضافه.
- فرمت: {"action": "BUY"|"SELL"|"HOLD", "confidence": عدد ۰ تا ۱۰۰, "reason": "توضیح کوتاه یک جمله‌ای به فارسی"}
- مهم: در حالت توربو باید جسورانه باشی. اگر روند یا مومنتوم حتی کمی جهت‌دار است، BUY یا SELL بده. HOLD فقط وقتی بده که RSI بین ۴۵ تا ۵۵ باشد و روند واقعاً خنثی و MACD نزدیک صفر باشد. انتظار نداشته باش همیشه HOLD بگویی — اکثر مواقع باید BUY یا SELL بدهی.
- اگر RSI بالای ۶۵ است به SELL و اگر زیر ۳۵ است به BUY تمایل نشان بده (بازگشت به میانگین).
- کراس MACD، موقعیت EMA9 نسبت به EMA21 و روند مهم‌ترین سیگنال‌ها هستند.
- «کارایی روند» (KER) بین ۰ تا ۱ است: زیر ۰٫۱۵ یعنی بازار چرخشی/بی‌رون است و در آن ورود کم‌بازده است — یا HOLD بده یا confidence را زیر ۶۰ نگه دار. بالای ۰٫۳ یعنی بازار جهت‌دار و مناسب ورود است.
- confidence: ست‌آپ قوی = ۷۵ تا ۹۵، ست‌آپ متوسط = ۶۲ تا ۷۵، مردد = ۵۰ تا ۶۲.
- reason باید حداکثر ۱۲ کلمه باشد و به ذکر حداقل یکی از اندیکاتورها بپردازد.`

export async function analyzeMarket(
  candles: Candle[],
  symbol = 'XAUUSD',
  recent?: RecentContext,
): Promise<AIVerdict & { indicators: ReturnType<typeof computeIndicators> }> {
  const indicators = computeIndicators(candles)
  const cfg = symbolConfig(symbol)
  const recentCandles = candles.slice(-24)
  const closes = recentCandles.map(c => c.c.toFixed(cfg.decimals)).join(', ')

  // adaptive line: the analyst knows how the bot has been doing lately
  let recentLine = ''
  if (recent && recent.wins + recent.losses > 0) {
    const total = recent.wins + recent.losses
    const acc = Math.round((recent.wins / total) * 100)
    const streakTxt = recent.streak >= 2
      ? `${recent.streak} برد پیاپی — اعتماد به نفس منطقی است`
      : recent.streak <= -2
        ? `${Math.abs(recent.streak)} باخت پیاپی — محتاط‌تر باش و فقط قوی‌ترین ست‌آپ‌ها را بگیر`
        : 'عملکرد متعادل'
    recentLine = `\nعملکرد اخیر ربات روی این حساب: ${recent.wins}برد / ${recent.losses}باخت (دقت ${acc}٪). ${streakTxt}.`
  }

  const payload = `داده‌های بازار ${cfg.fa} (${symbol}):
- قیمت لحظه‌ای: ${closes.split(', ').pop()}
- RSI(14): ${indicators.rsi}
- MACD: ${indicators.macd} / سیگنال: ${indicators.macdSignal} (هیستوگرام: ${(indicators.macd - indicators.macdSignal).toFixed(cfg.decimals > 2 ? 6 : 3)})
- EMA9: ${indicators.ema9} / EMA21: ${indicators.ema21} (روند: ${indicators.trend === 'UP' ? 'صعودی' : indicators.trend === 'DOWN' ? 'نزولی' : 'خنثی'})
- ATR(14): ${indicators.atr}
- کارایی روند KER: ${indicators.ker} (${indicators.ker < 0.15 ? 'بازار چرخشی/بی‌رون' : indicators.ker > 0.3 ? 'بازار جهت‌دار' : 'نرمال'})
- ۲۴ کندل اخیر (close): ${closes}
${recentLine}

نتیجه تحلیل را فقط به صورت JSON بده.`

  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT(symbol, cfg.fa) },
      { role: 'user', content: payload },
    ],
    temperature: 0.45,
    max_tokens: 200,
  })

  const raw: string = completion.choices[0]?.message?.content ?? ''
  return { ...parseVerdict(raw), indicators }
}

/** Local technical-analysis fallback — keeps the bot alive when GLM API is rate-limited/offline.
 *  `recentAccuracy`: win-rate (0..1) of this symbol's last trades; the verdict confidence
 *  shifts up/down a few points so a cold symbol trades less and a hot symbol trades more. */
export function localVerdict(candles: Candle[], recentAccuracy?: number): AIVerdict & { indicators: ReturnType<typeof computeIndicators> } {
  const indicators = computeIndicators(candles)
  let score = 0
  const reasons: string[] = []

  // RSI: mean reversion at extremes, mild lean otherwise
  if (indicators.rsi <= 30) { score += 2; reasons.push(`RSI اشباع فروش (${indicators.rsi})`) }
  else if (indicators.rsi >= 70) { score -= 2; reasons.push(`RSI اشباع خرید (${indicators.rsi})`) }
  else if (indicators.rsi < 45) { score += 1; reasons.push(`RSI پایین (${indicators.rsi})`) }
  else if (indicators.rsi > 55) { score -= 1; reasons.push(`RSI بالا (${indicators.rsi})`) }

  // MACD histogram direction
  const hist = indicators.macd - indicators.macdSignal
  if (hist > 0) { score += 1; reasons.push('هیستوگرام MACD مثبت') }
  else if (hist < 0) { score -= 1; reasons.push('هیستوگرام MACD منفی') }

  // EMA trend alignment
  if (indicators.trend === 'UP') { score += 1; reasons.push('EMA9 بالاتر از EMA21') }
  else if (indicators.trend === 'DOWN') { score -= 1; reasons.push('EMA9 پایین‌تر از EMA21') }

  // short-term momentum: last 3 candle closes
  if (candles.length >= 4) {
    const c = candles.map(x => x.c)
    const mom = c[c.length - 1] - c[c.length - 4]
    if (mom > 0) { score += 1; reasons.push('مومنتوم ۳ کندل اخیر صعودی') }
    else if (mom < 0) { score -= 1; reasons.push('مومنتوم ۳ کندل اخیر نزولی') }
  }

  // chop filter: Kaufman Efficiency Ratio — in a round-trip market entries have
  // negative expectancy regardless of indicator direction
  const choppy = indicators.ker < 0.12
  if (choppy) reasons.push(`بازار چرخشی (KER ${indicators.ker})`)

  let action: 'BUY' | 'SELL' | 'HOLD' = score >= 2 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD'
  if (choppy && Math.abs(score) < 4) action = 'HOLD'

  const base = action === 'HOLD'
    ? 40 + Math.abs(score) * 5
    : Math.min(88, 58 + Math.abs(score) * 7 + (indicators.rsi <= 30 || indicators.rsi >= 70 ? 6 : 0))
  // efficient market boost / choppy market damping
  let conf = choppy ? Math.min(base, 55) : indicators.ker > 0.3 ? base + 4 : base
  // adaptive nudge from the symbol's own recent track record (±4 points max)
  if (typeof recentAccuracy === 'number' && action !== 'HOLD') {
    conf += Math.max(-4, Math.min(4, Math.round((recentAccuracy - 0.5) * 8)))
  }
  const confidence = Math.max(0, Math.min(95, Math.round(conf)))

  const prefix = action === 'BUY' ? 'احتمال صعود — ' : action === 'SELL' ? 'احتمال نزول — ' : action === 'HOLD' && choppy ? 'بازار بی‌رون است — ' : 'سیگنال مبهم — '
  const reason = prefix + (reasons.length ? reasons.slice(0, 2).join(' و ') : 'تشخیص تکنیکال')
  return { action, confidence, reason, indicators }
}

function parseVerdict(raw: string): AIVerdict {
  try {
    // strip possible markdown fences
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) throw new Error('no json')
    const obj = JSON.parse(m[0])
    const action = ['BUY', 'SELL', 'HOLD'].includes(obj.action) ? obj.action : 'HOLD'
    const confidence = Math.max(0, Math.min(100, Math.round(Number(obj.confidence) || 0)))
    const reason = String(obj.reason || 'تحلیل انجام شد').slice(0, 140)
    return { action, confidence, reason }
  } catch {
    return { action: 'HOLD', confidence: 0, reason: 'پاسخ نامعتبر تحلیل‌گر — منتظر سیگنال بعدی' }
  }
}
