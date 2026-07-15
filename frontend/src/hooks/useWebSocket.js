import { useEffect, useRef, useCallback } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws'

export function useWebSocket(roomId, {
  onAnnotation,
  onStatus,
  onReply,
  onPresence,
  onCodeUpdate,
  onConnect,
}) {
  const clientRef = useRef(null)

  useEffect(() => {
    if (!roomId) return

    const token = sessionStorage.getItem('dc_token')
    if (!token) {
      console.error('[WS] No JWT token — cannot connect')
      return
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),

      // JWT in STOMP CONNECT frame — read by ChannelInterceptor on backend
      connectHeaders: { Authorization: `Bearer ${token}` },

      reconnectDelay: 3000,

      onConnect: () => {
        console.log('[WS] Connected to room:', roomId)

        client.subscribe(`/topic/room/${roomId}/annotations`, (msg) => {
          try { onAnnotation?.(JSON.parse(msg.body)) }
          catch (e) { console.error('[WS] annotation parse error', e) }
        })

        client.subscribe(`/topic/room/${roomId}/status`, (msg) => {
          try { onStatus?.(JSON.parse(msg.body)) }
          catch (e) { console.error('[WS] status parse error', e) }
        })

        client.subscribe(`/topic/room/${roomId}/replies`, (msg) => {
          try { onReply?.(JSON.parse(msg.body)) }
          catch (e) { console.error('[WS] reply parse error', e) }
        })

        client.subscribe(`/topic/room/${roomId}/presence`, (msg) => {
          try { onPresence?.(JSON.parse(msg.body)) }
          catch (e) { console.error('[WS] presence parse error', e) }
        })

        // Live code sync channel
        client.subscribe(`/topic/room/${roomId}/code`, (msg) => {
          try { onCodeUpdate?.(JSON.parse(msg.body)) }
          catch (e) { console.error('[WS] code-update parse error', e) }
        })

        // Send initial heartbeat
        _heartbeat(client, roomId, token)
        const hbInterval = setInterval(() => _heartbeat(client, roomId, token), 30000)
        client._hbInterval = hbInterval

        onConnect?.()
      },

      onDisconnect: () => {
        console.log('[WS] Disconnected')
        clearInterval(client._hbInterval)
      },

      onStompError: (frame) => {
        console.error('[WS] STOMP error:', frame.headers?.message, frame.body)
      },

      onWebSocketError: (e) => {
        console.error('[WS] WebSocket error:', e)
      },
    })

    client.activate()
    clientRef.current = client

    return () => {
      clearInterval(client._hbInterval)
      client.deactivate()
    }
  }, [roomId])

  // ── publish helpers ────────────────────────────────────────────────────────

  const sendAnnotation = useCallback((lineNumber, comment) => {
    _publish(clientRef, roomId, '/annotate', { lineNumber, comment })
  }, [roomId])

  const sendReply = useCallback((annotationId, content) => {
    _publish(clientRef, roomId, '/reply', { annotationId, content })
  }, [roomId])

  const sendCodeUpdate = useCallback((codeContent) => {
    _publish(clientRef, roomId, '/code-update', { codeContent })
  }, [roomId])

  return { sendAnnotation, sendReply, sendCodeUpdate }
}

// ── internal helpers ─────────────────────────────────────────────────────────

function _publish(clientRef, roomId, path, body) {
  const client = clientRef.current
  if (!client?.connected) {
    console.warn('[WS] Cannot publish — not connected yet')
    return
  }
  const token = sessionStorage.getItem('dc_token')
  client.publish({
    destination: `/app/room/${roomId}${path}`,
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
}

function _heartbeat(client, roomId, token) {
  if (client?.connected) {
    client.publish({
      destination: `/app/room/${roomId}/heartbeat`,
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({}),
    })
  }
}
