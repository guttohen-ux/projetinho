import { useEffect, useRef, useCallback } from 'react'

type WSMessage = {
  type: string
  [key: string]: any
}

export function useWebSocket(
  url: string,
  userId: string | null | undefined,
  onMessage: (msg: WSMessage) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = userId ? `${url}?userId=${encodeURIComponent(userId)}` : url
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => console.log('WebSocket connected')

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        onMessageRef.current(msg)
      } catch {}
    }

    ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting in 3s...')
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [url, userId])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])
}
