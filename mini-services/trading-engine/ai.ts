// ─── AI analyst: GLM model reads market snapshot & returns a trading verdict ───
import type { Candle } from './types'
import { computeIndicators } from './market'

export interface AIVerdict {
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reason: string
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

const SYSTEM_PROMPT = `تو یک تحلیل‌گر حرفه‌ای معاملات طلا (XAUUSD) هستی که برای یک ربات معامله‌گر خودکار حالت توربو کار می‌کنی.
بر اساس داده‌های کندل‌ها و اندیکاتورهای تکنیکال، جهت احتمالی حرکت کوتاه‌مدت (۳۰ تا ۶۰ ثانیه آینده) را پیش‌بینی کن.

قوانین:
- فقط با JSON پاسخ بده، بدون هیچ متن اضافه.
- فرمت: {"action": "BUY"|"SELL"|"HOLD", "confidence": عدد ۰ تا ۱۰۰, "reason": "توضیح کوتاه یک جمله‌ای به فارسی"}
- مهم: در حالت توربو باید جسورانه باشی. اگر روند یا مومنتوم حتی کمی جهت‌دار است، BUY یا SELL بده. HOLD فقط وقتی بده که RSI بین ۴۵ تا ۵۵ باشد و روند واقعاً خنثی و MACD نزدیک صفر باشد. انتظار نداشته باش همیشه HOLD بگویی — اکثر مواقع باید BUY یا SELL بدهی.
- اگر RSI بالای ۶۵ است به SELL و اگر زیر ۳۵ است به BUY تمایل نشان بده (بازگشت به میانگین).
- کراس MACD، موقعیت EMA9 نسبت به EMA21 و روند مهم‌ترین سیگنال‌ها هستند.
- confidence: ست‌آپ قوی = ۷۵ تا ۹۵، ست‌آپ متوسط = ۶۲ تا ۷۵، مردد = ۵۰ تا ۶۲.
- reason باید حداکثر ۱۲ کلمه باشد و به ذکر حداقل یکی از اندیکاتورها بپردازد.`

export async function analyzeMarket(candles: Candle[]): Promise<AIVerdict & { indicators: ReturnType<typeof computeIndicators> }> {
  const indicators = computeIndicators(candles)
  const recent = candles.slice(-24)
  const closes = recent.map(c => c.c.toFixed(2)).join(', ')

  const payload = `داده‌های بازار XAUUSD (طلا):
- قیمت لحظه‌ای: ${closes.split(', ').pop()} دلار
- RSI(14): ${indicators.rsi}
- MACD: ${indicators.macd} / سیگنال: ${indicators.macdSignal} (هیستوگرام: ${(indicators.macd - indicators.macdSignal).toFixed(3)})
- EMA9: ${indicators.ema9} / EMA21: ${indicators.ema21} (روند: ${indicators.trend === 'UP' ? 'صعودی' : indicators.trend === 'DOWN' ? 'نزولی' : 'خنثی'})
- ATR(14): ${indicators.atr}
- ۲۴ کندل اخیر (close): ${closes}

نتیجه تحلیل را فقط به صورت JSON بده.`

  const zai = await getZAI()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: payload },
    ],
    temperature: 0.45,
    max_tokens: 200,
  })

  const raw: string = completion.choices[0]?.message?.content ?? ''
  return { ...parseVerdict(raw), indicators }
}

/** Local technical-analysis fallback — keeps the bot alive when GLM API is rate-limited/offline. */
export function localVerdict(candles: Candle[]): AIVerdict & { indicators: ReturnType<typeof computeIndicators> } {
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

  const action = score >= 2 ? 'BUY' : score <= -2 ? 'SELL' : 'HOLD'
  const confidence = action === 'HOLD'
    ? 40 + Math.abs(score) * 5
    : Math.min(88, 58 + Math.abs(score) * 8 + (indicators.rsi <= 30 || indicators.rsi >= 70 ? 6 : 0))

  const prefix = action === 'BUY' ? 'احتمال صعود — ' : action === 'SELL' ? 'احتمال نزول — ' : 'سیگنال مبهم — '
  const reason = prefix + (reasons.length ? reasons.slice(0, 2).join(' و ') : 'تشخیص تکنیکال')
  return { action, confidence: Math.round(confidence), reason, indicators }
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
