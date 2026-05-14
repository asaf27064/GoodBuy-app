import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import io from 'socket.io-client'
import { API_BASE } from '../config'
import { useAuth } from './AuthContext'

const ListSocketContext = createContext(null)

export const ListSocketProvider = ({ children }) => {
  const { token } = useAuth()
  const socketRef = useRef(null)
  const pending = useRef([])
  const [connected, setConnected] = useState(false)
  const [editingUsers, setEditingUsers] = useState({})

  useEffect(() => {
    if (!token) return
    // Re-created whenever `token` changes (login, refresh-rotation, logout).
    // Each fresh socket carries the current access token in its handshake.
    setConnected(false)
    const socket = io(API_BASE, { auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      // Drain any listeners registered before the connection was open.
      const queued = pending.current
      pending.current = []
      queued.forEach(([ev, cb]) => socket.on(ev, cb))
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('editingUsers', ({ user, type }) => {
      setEditingUsers(prev => {
        const id = user.listId
        const set = new Set(prev[id] || [])
        if (type === 'add') set.add(user.username)
        if (type === 'remove') set.delete(user.username)
        return { ...prev, [id]: [...set] }
      })
    })

    return () => {
      // Only drop the ref if it still points at this socket — guards against
      // a stale cleanup overwriting a newer connection during rapid re-runs.
      if (socketRef.current === socket) socketRef.current = null
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [token])

  const on = (ev, cb) => {
    if (connected && socketRef.current) socketRef.current.on(ev, cb)
    else pending.current.push([ev, cb])
  }

  const off = (ev, cb) => {
    if (connected && socketRef.current) socketRef.current.off(ev, cb)
    pending.current = pending.current.filter(p => p[0] !== ev || p[1] !== cb)
  }

  const emit = (ev, data) => {
    if (socketRef.current && socketRef.current.connected) socketRef.current.emit(ev, data)
  }

  const joinList  = id => emit('joinList',  { listId: id })
  const leaveList = id => emit('leaveList', { listId: id })
  const startEdit = (id, user) => emit('editingStart', { listId: id, user })
  const stopEdit  = (id, user) => emit('editingStop',  { listId: id, user })

  return (
    <ListSocketContext.Provider value={{ on, off, joinList, leaveList, startEdit, stopEdit, editingUsers }}>
      {children}
    </ListSocketContext.Provider>
  )
}

export const useListSocket = () => useContext(ListSocketContext)
