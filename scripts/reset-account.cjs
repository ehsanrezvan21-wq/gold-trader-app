const { io } = require('socket.io-client')
const socket = io('http://127.0.0.1:3003', { transports: ['websocket'], path: '/' })
socket.on('connect', () => {
  socket.emit('reset-account')
  socket.emit('set-symbol', 'XAUUSD')
  setTimeout(() => socket.close(), 800)
})
socket.on('state', s => {
  if (s.trades.length === 0 && s.balance === 100) {
    console.log('RESET OK — balance:', s.balance, '| activeSymbol:', s.settings.activeSymbol, '| trades:', s.trades.length)
  }
})
setTimeout(() => process.exit(0), 3000)
