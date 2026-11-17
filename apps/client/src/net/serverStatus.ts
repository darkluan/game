import { Client, type Room } from '@colyseus/sdk';
import { useCallback, useEffect, useState } from 'react';
import { runtimeConfig } from '@/lib/runtimeConfig';

export type ServerStatus =
  { state: 'connecting' } | { state: 'online'; pingMs: number; tickRate: number } | { state: 'offline' };

/** Phase 0 connectivity check: joins the server's ping room and measures one round trip. */
export function useServerStatus(): { status: ServerStatus; retry: () => void } {
  const [status, setStatus] = useState<ServerStatus>({ state: 'connecting' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let room: Room | undefined;
    const client = new Client(runtimeConfig.serverUrl);
    client
      .joinOrCreate('ping')
      .then((joined) => {
        room = joined;
        if (cancelled) return void joined.leave();
        const sentAt = performance.now();
        joined.onMessage('pong', (msg: { tickRate: number }) => {
          if (!cancelled) {
            setStatus({ state: 'online', pingMs: Math.round(performance.now() - sentAt), tickRate: msg.tickRate });
          }
        });
        joined.onLeave(() => {
          if (!cancelled) setStatus({ state: 'offline' });
        });
        joined.send('ping');
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: 'offline' });
      });
    return () => {
      cancelled = true;
      void room?.leave();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus({ state: 'connecting' });
    setAttempt((n) => n + 1);
  }, []);
  return { status, retry };
}
