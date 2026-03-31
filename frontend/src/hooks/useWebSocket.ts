'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  payload: unknown;
}

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useWebSocket(sessionId: string | null) {
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    function connect() {
      const wsUrl = process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'ws://localhost:3001';
      const ws = new WebSocket(`${wsUrl}/ws?sessionId=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        reconnectAttempts.current = 0;
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(true);
          reconnectAttempts.current += 1;
          const delay = RECONNECT_DELAY_MS * Math.min(reconnectAttempts.current, 5);
          reconnectTimer.current = setTimeout(connect, delay);
        } else {
          setReconnecting(false);
        }
      };

      ws.onerror = () => {
        // onclose will fire after onerror — reconnect handled there
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as WSMessage;
          setLastMessage(msg);
        } catch {
          console.error('[useWebSocket] Failed to parse message');
        }
      };
    }

    connect();

    return () => {
      reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // prevent reconnect on unmount
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [sessionId]);

  const sendMessage = useCallback((msg: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return { lastMessage, connected, reconnecting, sendMessage };
}
