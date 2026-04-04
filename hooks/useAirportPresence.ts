'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_AIRPORT } from '@/lib/defaultAirport';
import { useSelectedAirportsStore } from '@/lib/stores/selectedAirportsStore';
import { usePresenceStore } from '@/lib/stores/presenceStore';

const FALLBACK_HEARTBEAT_INTERVAL_MS = 20_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

interface PresenceWelcomeMessage {
  type: 'welcome';
  sessionId: string;
  heartbeatIntervalMs: number;
  sessionTtlMs: number;
}

interface PresenceUpdateMessage {
  type: 'presence';
  sessionId: string;
  airportIdent: string | null;
  totalUsers: number;
  airportUsers: number;
}

interface PresenceErrorMessage {
  type: 'error';
  message: string;
}

type PresenceServerMessage = PresenceWelcomeMessage | PresenceUpdateMessage | PresenceErrorMessage;

function buildPresenceUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/presence`;
}

export function useAirportPresence() {
  const hasHydrated = useSelectedAirportsStore((state) => state.hasHydrated);
  const selectedAirportIdent = useSelectedAirportsStore(
    (state) => state.selectedAirports[0]?.ident ?? DEFAULT_AIRPORT.ident,
  );
  const setPresence = usePresenceStore((state) => state.setPresence);
  const setConnected = usePresenceStore((state) => state.setConnected);
  const resetPresence = usePresenceStore((state) => state.resetPresence);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const heartbeatIntervalMsRef = useRef(FALLBACK_HEARTBEAT_INTERVAL_MS);
  const stoppedRef = useRef(false);
  const selectedAirportIdentRef = useRef(selectedAirportIdent);
  const hasHydratedRef = useRef(hasHydrated);

  selectedAirportIdentRef.current = selectedAirportIdent;
  hasHydratedRef.current = hasHydrated;

  useEffect(() => {
    function clearReconnectTimer() {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    }

    function clearHeartbeatTimer() {
      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    }

    function sendHeartbeat() {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }

      socket.send(
        JSON.stringify({
          type: 'heartbeat',
          airportIdent: selectedAirportIdentRef.current,
        }),
      );
    }

    function startHeartbeatLoop() {
      clearHeartbeatTimer();
      heartbeatTimerRef.current = window.setInterval(() => {
        sendHeartbeat();
      }, heartbeatIntervalMsRef.current);
    }

    function connect() {
      if (!hasHydratedRef.current || stoppedRef.current) {
        return;
      }

      clearReconnectTimer();

      const existingSocket = socketRef.current;
      if (
        existingSocket &&
        (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      const socket = new WebSocket(buildPresenceUrl());
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        sendHeartbeat();
        startHeartbeatLoop();
      });

      socket.addEventListener('message', (event) => {
        const parsed = JSON.parse(event.data) as PresenceServerMessage;

        if (parsed.type === 'welcome') {
          heartbeatIntervalMsRef.current = parsed.heartbeatIntervalMs;
          sendHeartbeat();
          startHeartbeatLoop();
          return;
        }

        if (parsed.type === 'presence') {
          setPresence({
            connected: true,
            totalUsers: parsed.totalUsers,
            airportUsers: parsed.airportUsers,
            airportIdent: parsed.airportIdent,
          });
          return;
        }

        if (parsed.type === 'error') {
          console.error('[presence] Server error:', parsed.message);
        }
      });

      socket.addEventListener('close', () => {
        if (socketRef.current === socket) {
          socketRef.current = null;
        }

        setConnected(false);
        clearHeartbeatTimer();

        if (stoppedRef.current || reconnectTimerRef.current !== null) {
          return;
        }

        const delay = Math.min(1_000 * 2 ** reconnectAttemptRef.current, MAX_RECONNECT_DELAY_MS);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      });

      socket.addEventListener('error', (event) => {
        console.error('[presence] Connection error:', event);
      });
    }

    if (!hasHydrated) {
      return;
    }

    stoppedRef.current = false;
    connect();

    return () => {
      stoppedRef.current = true;
      resetPresence();
      clearReconnectTimer();
      clearHeartbeatTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      socket?.close();
    };
  }, [hasHydrated, resetPresence, setConnected, setPresence]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: 'heartbeat',
          airportIdent: selectedAirportIdent,
        }),
      );
    }
  }, [hasHydrated, selectedAirportIdent]);
}
