// Verify v2 engine: new settings fields, migrated stats, manual trade flow
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { path: '/', transports: ['websocket'] })

let step = 0
const fail = (msg: string) => { console.error('FAIL:', msg); process.exit(1) }
const done = () => { console.log('ALL CHECKS PASSED'); process.exit(0) }

setTimeout(() => fail('timeout waiting for state'), 15000)

socket.on('connect', () => console.log('connected'))
socket.on('connect_error', (e: Error) => console.log('connect_error:', e.message))
socket.on('error-msg', m => console.log('error-msg:', m))

socket.on('state', (s: any) => {
  if (step === 0) {
    step = 1
    // 1) new settings present
    if (typeof s.settings.cooldownAfterLossSec !== 'number') return fail('cooldownAfterLossSec missing in settings')
    if (typeof s.settings.maxConsecutiveLosses !== 'number') return fail('maxConsecutiveLosses missing in settings')
    // 2) migrated stats have all new numeric fields
    const need = ['bestTrade', 'worstTrade', 'streak', 'bestStreak', 'worstStreak', 'grossProfit', 'grossLoss']
    for (const k of need) if (typeof s.stats[k] !== 'number') return fail(`stats.${k} missing (migration broken)`)
    // 3) signals include ker indicator
    if (s.signals.length > 0 && typeof s.signals[0].indicators?.ker !== 'number') return fail('signal indicators.ker missing')
    console.log('settings:', s.settings.cooldownAfterLossSec, 'sec cooldown,', s.settings.maxConsecutiveLosses, 'max-loss-streak')
    console.log('stats:', JSON.stringify(s.stats))
    console.log('balance:', s.balance, '| signals so far:', s.signals.length, '| last ker:', s.signals[0]?.indicators?.ker)
    // 4) open a manual trade
    socket.emit('manual-trade', 'BUY')
    setTimeout(() => { step = 2 }, 1200)
  } else if (step === 2) {
    const open = s.trades.filter((t: any) => t.status === 'open')
    if (open.length === 0) return fail('manual trade did not open')
    console.log('manual trade open:', open[0].direction, '@', open[0].openPrice, 'closes in', open[0].durationSec, 's')
    done()
  }
})
