const { io } = require('socket.io-client')
const socket = io('http://127.0.0.1:3003', { transports: ['websocket'], path: '/' })
socket.on('connect', () => {
  setTimeout(() => socket.close(), 1200)
})
socket.on('state', s => {
  const ticks = Object.entries(s.symbolTicks).map(([k, v]) => `${k}=${v.price}`).join(' | ')
  console.log(`FINAL: balance=$${s.balance} | active=${s.settings.activeSymbol} | trades=${s.trades.length} | ticks: ${ticks}`)
  process.exit(0)
})
setTimeout(() => process.exit(1), 5000)
