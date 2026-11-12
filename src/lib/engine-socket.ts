'use client'

import { io, type Socket } from 'socket.io-client'

export function connectEngine(handlers: {
  onState: (s: any) => void
  onTick: (t: any) => void
  onError?: (m: string) => void
}): Socket {
  const socket = io('/?XTransformPort=3003', {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  })

  socket.on('state', handlers.onState)
  socket.on('tick', handlers.onTick)
  socket.on('error-msg', (m: string) => handlers.onError?.(m))
  return socket
}
