'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  payload: unknown;
}

export function useWebSocket(sessionId: string | null) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:3001';
    const ws = new WebSocket(`${wsUrl}/ws?sessionId=${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(() => {
        if (sessionId) wsRef.current = null;
      }, 2000);
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        setLastMessage(msg);
      } catch {
        console.error('[useWebSocket] Failed to parse message');
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const sendMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { lastMessage, connected, sendMessage };
}
