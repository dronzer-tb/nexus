'use client'

import { io } from 'socket.io-client'

let socket = null

export function initSocket(backendToken) {
  if (socket?.connected) {
    return socket
  }

  // Disconnect old socket if exists
  if (socket) {
    socket.disconnect()
  }

  // Create new socket connection
  socket = io(window.location.origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token: backendToken },
  })

  socket.on('connect', () => {
    console.log('✓ Socket connected:', socket.id)
  })

  socket.on('disconnect', () => {
    console.log('✗ Socket disconnected')
  })

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error)
  })

  return socket
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
