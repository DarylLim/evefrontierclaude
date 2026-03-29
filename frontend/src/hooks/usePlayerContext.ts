'use client';

import { useEffect, useState } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useWebSocket } from './useWebSocket';
import { AlertCard, PlayerContext } from '@/types';

const BACKEND_HTTP_URL = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? 'http://localhost:3001';

export function usePlayerContext() {
  const account = useCurrentAccount();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playerContext, setPlayerContext] = useState<PlayerContext | null>(null);
  const [alerts, setAlerts] = useState<AlertCard[]>([]);
  const { lastMessage } = useWebSocket(sessionId);

  // Init session when wallet connects
  useEffect(() => {
    if (!account?.address) return;

    fetch(`${BACKEND_HTTP_URL}/api/session/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: account.address }),
    })
      .then((r) => r.json() as Promise<{ sessionId: string }>)
      .then(({ sessionId }) => setSessionId(sessionId))
      .catch((err) => console.error('[usePlayerContext] session init failed:', err));

    return () => {
      if (sessionId) {
        fetch(`${BACKEND_HTTP_URL}/api/session/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      }
    };
  }, [account?.address]);

  // Handle incoming WS messages
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'player_context') {
      setPlayerContext(lastMessage.payload as PlayerContext);
    } else if (lastMessage.type === 'alert') {
      const alert = lastMessage.payload as AlertCard;
      setAlerts((prev) => {
        const exists = prev.some((a) => a.id === alert.id);
        if (exists) return prev;
        return [alert, ...prev].slice(0, 20);
      });
    }
  }, [lastMessage]);

  return { playerContext, alerts, sessionId };
}
