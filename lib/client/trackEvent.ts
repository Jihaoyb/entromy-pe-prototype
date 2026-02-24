'use client';

export type DemoEventName =
  | 'agent_started'
  | 'audio_connected'
  | 'fallback_triggered'
  | 'escalated_to_specialist'
  | 'subscribe_submitted';

export function trackDemoEvent(event: DemoEventName, meta?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  void fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, meta, timestamp: Date.now() }),
    keepalive: true
  }).catch(() => undefined);
}
