// useCaseWebSocket — subscribes to /api/ws/cases/{caseId}, calls onEvent for
// each server event. Falls back to a 10s polling ticker whenever the socket
// is disconnected (initial failure, closed, or error) so the UI never goes
// silently stale.
import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

const POLL_INTERVAL_MS = 10_000;

// Convert https://host to wss://host (or http → ws).
const wsBase = () => (BACKEND_URL || "").replace(/^http/, "ws");

/**
 * @param {string} caseId
 * @param {(evt: {event:string, payload:any, at:string}) => void} onEvent
 * @param {() => void} onPollTick - called when we're in fallback polling mode
 * @param {string|null} sessionToken - optional token to append as ?token=...
 *   (cookies also work same-origin but this is more reliable behind proxies)
 */
export function useCaseWebSocket(caseId, onEvent, onPollTick, sessionToken = null) {
  const [connected, setConnected] = useState(false);
  const [polling, setPolling] = useState(false);
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const retryRef = useRef(null);
  const closedByUsRef = useRef(false);

  useEffect(() => {
    if (!caseId) return undefined;
    closedByUsRef.current = false;

    const stopPolling = () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      setPolling(false);
    };
    const startPolling = () => {
      if (pollRef.current) return;
      setPolling(true);
      pollRef.current = setInterval(() => { try { onPollTick?.(); } catch { /* noop */ } }, POLL_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      if (closedByUsRef.current) return;
      if (retryRef.current) return;
      startPolling();
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        openSocket();
      }, 3000);
    };

    const openSocket = () => {
      try {
        const tokenQ = sessionToken ? `?token=${encodeURIComponent(sessionToken)}` : "";
        const url = `${wsBase()}/api/ws/cases/${caseId}${tokenQ}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          stopPolling();
        };
        ws.onmessage = (m) => {
          try {
            const parsed = JSON.parse(m.data);
            onEvent?.(parsed);
          } catch { /* ignore malformed */ }
        };
        ws.onerror = () => { /* onclose will fire */ };
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    openSocket();

    return () => {
      closedByUsRef.current = true;
      if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
      stopPolling();
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) { try { ws.close(1000); } catch { /* noop */ } }
    };
    // Ordering-sensitive: intentionally only re-subscribing on caseId change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, sessionToken]);

  return { connected, polling };
}
