// End-to-end verification of iteration 3: mt5Test field, manual trade, settings patch
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { path: '/', transports: ['polling', 'websocket'] })

let step = 0
function done(label, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label}${extra ? ' | ' + extra : ''}`)
  if (!ok) process.exit(1)
  step++
  if (step >= 4) {
    console.log('ALL CHECKS PASSED')
    process.exit(0)
  }
}

socket.on('connect', () => {
  // clean slate: reset account, then let the state flow (engine pushes state on connect)
  socket.emit('reset-account')
})

let step1At = 0
let step3At = 0

socket.on('state', (s) => {
  if (step === 0) {
    const ok = s.mt5Test && s.mt5Test.status === 'idle' && typeof s.settings.tradeDurationSec === 'number'
    done('state has mt5Test field', ok, `status=${s.mt5Test?.status} dur=${s.settings.tradeDurationSec}`)
    // trigger the MT5 test with empty credentials -> expect immediate error result
    socket.emit('test-mt5')
  } else if (step === 1) {
    // wait until the test result is final (success | error), not the transient 'testing';
    // tolerate residual 'idle' broadcasts for up to 2.5s
    if (s.mt5Test.status === 'testing') return
    if (s.mt5Test.status === 'idle') {
      if (!step1At) step1At = Date.now()
      if (Date.now() - step1At < 2500) return
    }
    const ok = s.mt5Test.status === 'error' && s.mt5Test.message.length > 5
    done('test-mt5 with empty credentials -> error message', ok, `${s.mt5Test.status} | ${s.mt5Test.message}`)
    // set a longer turbo duration
    socket.emit('update-settings', { tradeDurationSec: 120 })
  } else if (step === 2) {
    const ok = s.settings.tradeDurationSec === 120
    done('turbo duration patched to 120s', ok, `dur=${s.settings.tradeDurationSec}`)
    // open a manual trade on gold
    socket.emit('manual-trade', 'BUY', 'XAUUSD')
    setTimeout(() => socket.emit('get-state'), 800)
  } else if (step === 3) {
    // tolerate broadcasts that predate the manual-trade processing (retry up to 4s)
    const open = s.trades.filter(t => t.status === 'open')
    if (open.length === 0) {
      if (!step3At) step3At = Date.now()
      if (Date.now() - step3At < 4000) return
    }
    const ok = open.length === 1 && open[0].durationSec === 120 && open[0].symbol === 'XAUUSD'
    done('manual trade opened with 120s duration', ok, `open=${open.length} dur=${open[0]?.durationSec}`)
  }
})

socket.on('error-msg', (m) => console.log('engine msg:', m))
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 15000)
