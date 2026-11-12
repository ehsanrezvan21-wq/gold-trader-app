// ─── Broker layer: demo simulator + real MT5 through MetaApi cloud REST ───
import type { BotSettings, Direction, MT5AccountInfo } from './types'
import { PIP } from './market'

export interface OpenResult {
  ok: boolean
  positionId?: string
  openPrice?: number
  error?: string
}

export interface CloseResult {
  ok: boolean
  closePrice?: number
  pnl?: number
  error?: string
}

export interface AccountResult {
  ok: boolean
  info?: MT5AccountInfo
  error?: string
}

const SYMBOL = 'XAUUSD'

function apiBase(region: string) {
  return `https://mt-client-api-v1.${region}.agiliumtrade.ai`
}

async function metaApiFetch(
  settings: BotSettings,
  path: string,
  init: RequestInit = {},
  timeoutMs = 15000,
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiBase(settings.metaapiRegion)}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        'auth-token': settings.metaapiToken,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    })
    return res
  } finally {
    clearTimeout(t)
  }
}

function persianApiError(status: number, body: string): string {
  if (status === 401 || status === 403)
    return 'توکن MetaApi نامعتبر است یا منقضی شده — توکن را در تنظیمات بررسی کنید'
  if (status === 404)
    return 'حساب یافت نشد — مطمئن شوید حساب در پنل MetaApi مستقر (deploy) شده است'
  if (status === 429) return 'محدودیت تعداد درخواست‌های MetaApi — کمی صبر کنید'
  const snippet = body?.slice(0, 160)
  return `خطای MetaApi (${status}): ${snippet || 'بدون جزئیات'}`
}

/** Open a market order on the real MT5 account via MetaApi. */
export async function mt5Open(
  settings: BotSettings,
  direction: Direction,
  comment: string,
): Promise<OpenResult> {
  try {
    // fetch current price
    const priceRes = await metaApiFetch(settings, `/users/current/accounts/${settings.metaapiAccountId}/symbol/${SYMBOL}/price`)
    if (!priceRes.ok) return { ok: false, error: persianApiError(priceRes.status, await priceRes.text()) }
    const priceJson: any = await priceRes.json()
    const openPrice = direction === 'BUY' ? Number(priceJson.ask) : Number(priceJson.bid)
    if (!openPrice) return { ok: false, error: 'قیمت نماد از سرور دریافت نشد' }

    const sl = direction === 'BUY' ? openPrice - settings.slPips * PIP : openPrice + settings.slPips * PIP
    const tp = direction === 'BUY' ? openPrice + settings.tpPips * PIP : openPrice - settings.tpPips * PIP

    const openRes = await metaApiFetch(settings, `/users/current/accounts/${settings.metaapiAccountId}/positions`, {
      method: 'POST',
      body: JSON.stringify({
        actionType: direction === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        symbol: SYMBOL,
        volume: settings.mt5Lots,
        stopLoss: +sl.toFixed(2),
        takeProfit: +tp.toFixed(2),
        comment: comment.slice(0, 26),
      }),
    })
    if (!openRes.ok) return { ok: false, error: persianApiError(openRes.status, await openRes.text()) }
    const openJson: any = await openRes.json()
    const positionId = String(openJson.positionId ?? openJson.orderId ?? '')
    if (!positionId) return { ok: false, error: 'سفارش ثبت شد ولی شناسه پوزیشن برگردانده نشد' }
    return { ok: true, positionId, openPrice }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'زمان انتظار اتصال به MetaApi تمام شد' : e?.message || 'خطای شبکه'
    return { ok: false, error: `اتصال به MetaApi برقرار نشد: ${msg}` }
  }
}

/** Close an open MT5 position. */
export async function mt5Close(settings: BotSettings, positionId: string): Promise<CloseResult> {
  try {
    const res = await metaApiFetch(
      settings,
      `/users/current/accounts/${settings.metaapiAccountId}/positions/${positionId}`,
      { method: 'DELETE' },
    )
    if (!res.ok) return { ok: false, error: persianApiError(res.status, await res.text()) }
    const json: any = await res.json().catch(() => ({}))
    return { ok: true, pnl: typeof json?.profit === 'number' ? json.profit : undefined }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'زمان انتظار اتصال تمام شد' : e?.message || 'خطای شبکه'
    return { ok: false, error: `بستن پوزیشن ناموفق بود: ${msg}` }
  }
}

/** Fetch account info (balance/equity) from MetaApi. */
export async function mt5Account(settings: BotSettings): Promise<AccountResult> {
  try {
    const res = await metaApiFetch(settings, `/users/current/accounts/${settings.metaapiAccountId}/account-information`)
    if (!res.ok) return { ok: false, error: persianApiError(res.status, await res.text()) }
    const j: any = await res.json()
    return {
      ok: true,
      info: {
        broker: String(j.broker || '—'),
        currency: String(j.currency || 'USD'),
        balance: Number(j.balance ?? 0),
        equity: Number(j.equity ?? j.balance ?? 0),
        marginFree: Number(j.freeMargin ?? 0),
        server: String(j.server || '—'),
      },
    }
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'زمان انتظار اتصال تمام شد' : e?.message || 'خطای شبکه'
    return { ok: false, error: `اتصال به MetaApi برقرار نشد: ${msg}` }
  }
}

/** Fetch open positions (to find live PnL of our position). */
export async function mt5Positions(settings: BotSettings): Promise<{ ok: boolean; positions?: any[]; error?: string }> {
  try {
    const res = await metaApiFetch(settings, `/users/current/accounts/${settings.metaapiAccountId}/positions`)
    if (!res.ok) return { ok: false, error: persianApiError(res.status, await res.text()) }
    return { ok: true, positions: await res.json() }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'خطای شبکه' }
  }
}

// ─── Demo broker helpers ───

export function demoSettle(
  direction: Direction,
  openPrice: number,
  closePrice: number,
): 'WIN' | 'LOSS' | 'DRAW' {
  if (closePrice === openPrice) return 'DRAW'
  const movedUp = closePrice > openPrice
  const win = (direction === 'BUY' && movedUp) || (direction === 'SELL' && !movedUp)
  return win ? 'WIN' : 'LOSS'
}
