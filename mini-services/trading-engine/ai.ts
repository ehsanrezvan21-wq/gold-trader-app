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

const SYSTEM_PROMPT = `تو یک تحلیل‌گر حرفه‌ای معاملات طلا (XAUUSD) هستی که برای یک ربات معامله‌گر خودکار کار می‌کنی.
بر اساس داده‌های کندل‌ها و اندیکاتورهای تکنیکال که به تو داده می‌شود، جهت احتمالی حرکت کوتاه‌مدت (۳۰ تا ۶۰ ثانیه آینده در حالت توربو) را پیش‌بینی کن.

قوانین:
- فقط با JSON پاسخ بده، بدون هیچ متن اضافه.
- فرمت: {"action": "BUY"|"SELL"|"HOLD", "confidence": عدد ۰ تا ۱۰۰, "reason": "توضیح کوتاه یک جمله‌ای به فارسی"}
- اگر تشخیص می‌دهی روند واضحی نیست یا ریسک بالا است، HOLD بده.
- اگر RSI اشباع خرید (>70) است احتمالا SELL منطقی‌تر است، اگر اشباع فروش (<30) است احتمالا BUY.
- کراس MACD و موقعیت EMA9 نسبت به EMA21 و روند (trend) مهم‌ترین سیگنال‌ها هستند.
- confidence را واقع‌بینانه بده؛ ۹۵+ فقط برای ست‌آپ‌های بسیار قوی.
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
    temperature: 0.3,
    max_tokens: 200,
  })

  const raw: string = completion.choices[0]?.message?.content ?? ''
  return { ...parseVerdict(raw), indicators }
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
