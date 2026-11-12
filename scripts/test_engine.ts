// quick smoke test for the trading engine
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { transports: ['websocket', 'polling'] })

socket.on('connect', () => console.log('connected:', socket.id))
socket.on('state', (s: any) => {
  console.log('--- STATE ---')
  console.log('balance:', s.balance, 'mode:', s.settings.mode, 'botRunning:', s.settings.botRunning)
  console.log('tick:', s.tick?.price)
  console.log('candles:', s.candles?.length)
  console.log('signals:', s.signals?.length)
  console.log('logs:')
  for (const l of (s.logs || []).slice(0, 6)) console.log('  ', l.level, '|', l.message)
  socket.close()
  process.exit(0)
})
setTimeout(() => { console.log('TIMEOUT'); process.exit(1) }, 10000)
