import { NextResponse } from 'next/server';

const allowedEvents = new Set([
  'agent_started',
  'audio_connected',
  'fallback_triggered',
  'escalated_to_specialist',
  'subscribe_submitted'
]);

interface EventsRequestBody {
  event?: string;
  meta?: Record<string, unknown>;
  timestamp?: number;
}

function sanitizeMeta(meta: Record<string, unknown> | undefined) {
  if (!meta) return undefined;
  const entries = Object.entries(meta).slice(0, 8);
  return Object.fromEntries(
    entries.map(([key, value]) => {
      const stringValue = typeof value === 'string' ? value.slice(0, 120) : String(value);
      return [key, stringValue];
    })
  );
}

export async function POST(request: Request) {
  let payload: EventsRequestBody | null = null;

  try {
    payload = (await request.json()) as EventsRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid event payload.' }, { status: 400 });
  }

  const eventName = payload?.event?.trim();
  if (!eventName || !allowedEvents.has(eventName)) {
    return NextResponse.json({ ok: false, error: 'Invalid event name.' }, { status: 400 });
  }

  console.info('[api/events]', {
    event: eventName,
    timestamp: payload?.timestamp ?? Date.now(),
    meta: sanitizeMeta(payload?.meta)
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
