// End-to-end socket test for the multi-symbol trading engine
const { io } = require('socket.io-client')

const socket = io('http://127.0.0.1:3003', { transports: ['websocket'], path: '/' })
const results = {}
const check = (name, ok, extra = '') => {
  results[name] = ok
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ' | ' + extra : ''}`)
}

let state = null
socket.on('state', s => {
  state = s
})
socket.on('ticks', all => {
  if (!results['3 symbols tick']) {
    const syms = Object.keys(all)
    const allTick = syms.length === 3 && syms.every(k => all[k] && all[k].price > 0)
    check('3 symbols tick', allTick, JSON.stringify(Object.fromEntries(syms.map(k => [k, all[k].price]))))
  }
})
socket.on('error-msg', m => console.log('SERVER-ERROR:', m))

socket.on('connect', () => {
  console.log('connected:', socket.id)
  setTimeout(() => {
    if (!state) return check('state received', false)
    check('state received', true)
    check('symbolTicks in state', state.symbolTicks && Object.keys(state.symbolTicks).length === 3)
    check('activeSymbol default XAUUSD', state.settings.activeSymbol === 'XAUUSD', state.settings.activeSymbol)
    check('candles present', Array.isArray(state.candles) && state.candles.length > 50, `n=${state.candles?.length}`)

    // 1) switch to BTCUSD
    socket.emit('set-symbol', 'BTCUSD')
    setTimeout(() => {
      check('switch to BTCUSD', state?.settings.activeSymbol === 'BTCUSD', state?.settings.activeSymbol)
      const btcCandles = state?.candles ?? []
      const first = btcCandles[0]
      check('BTC candles loaded (price ~ 97250)', btcCandles.length > 50 && first && first.c > 50000, `first close=${first?.c}`)

      // 2) manual trade on BTCUSD
      socket.emit('manual-trade', 'BUY', 'BTCUSD')
      setTimeout(() => {
        const t = state?.trades?.[0]
        check('manual BTC trade opened', t && t.symbol === 'BTCUSD' && t.status === 'open', t ? `${t.symbol} ${t.direction} @${t.openPrice}` : 'none')

        // 3) switch to EURUSD and check chart
        socket.emit('set-symbol', 'EURUSD')
        setTimeout(() => {
          check('switch to EURUSD', state?.settings.activeSymbol === 'EURUSD', state?.settings.activeSymbol)
          const eur = state?.candles?.[0]
          check('EUR candles loaded (~1.08)', eur && eur.c > 0.9 && eur.c < 1.3, `close=${eur?.c}`)

          // 4) open manual trade on EURUSD
          socket.emit('manual-trade', 'SELL', 'EURUSD')
          setTimeout(() => {
            const trades = state?.trades?.filter(t => t.status === 'open') ?? []
            check('open trades across 2 symbols', trades.length >= 2 && trades.some(t => t.symbol === 'BTCUSD') && trades.some(t => t.symbol === 'EURUSD'),
              trades.map(t => `${t.symbol}@${t.openPrice}`).join(' + '))

            // 5) wait for turbo settlement (durationSec=45 default... actually 30-45)
            const maxDur = Math.max(...trades.map(t => t.durationSec), 0)
            console.log(`waiting ${maxDur + 4}s for settlement...`)
            setTimeout(() => {
              const closed = (state?.trades ?? []).filter(t => t.symbol === 'BTCUSD' || t.symbol === 'EURUSD').filter(t => t.status === 'closed')
              check('multi-symbol trades settled', closed.length >= 2, closed.map(t => `${t.symbol}:${t.result}:${t.pnl}`).join(' + '))
              const bal = state?.balance
              check('balance updated', typeof bal === 'number' && bal > 0, `balance=${bal}`)
              const sigs = state?.signals ?? []
              check('signals carry symbol', sigs.length > 0 && sigs.every(s => !!s.symbol), sigs.slice(0, 3).map(s => `${s.symbol}:${s.action}:${s.confidence}`).join(' | '))
              console.log('===DONE===')
              socket.close()
              process.exit(Object.values(results).every(Boolean) ? 0 : 1)
            }, (maxDur + 4) * 1000)
          }, 1500)
        }, 1500)
      }, 1500)
    }, 1500)
  }, 2500)
})

socket.on('connect_error', e => {
  console.log('CONNECT ERROR:', e.message)
  process.exit(1)
})

setTimeout(() => {
  console.log('GLOBAL TIMEOUT — results:', results)
  process.exit(1)
}, 120000)
