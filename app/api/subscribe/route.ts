import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/server/serverConfig';
import { isValidEmailAddress } from '@/lib/validation/email';

interface SubscribeRequestBody {
  email: string;
}

interface SubscribeSuccessResponse {
  ok: true;
  message: string;
}

interface SubscribeErrorResponse {
  ok: false;
  error: string;
}

function parsePayload(payload: unknown): SubscribeRequestBody | null {
  if (!payload || typeof payload !== 'object') return null;
  const maybeBody = payload as Partial<SubscribeRequestBody>;
  if (typeof maybeBody.email !== 'string') return null;

  const email = maybeBody.email.trim();
  if (!isValidEmailAddress(email)) return null;

  return { email };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    const errorResponse: SubscribeErrorResponse = { ok: false, error: 'Invalid JSON payload.' };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const body = parsePayload(payload);
  if (!body) {
    const errorResponse: SubscribeErrorResponse = { ok: false, error: 'Please provide a valid email address.' };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const { subscribeMode } = getServerConfig();

  if (subscribeMode === 'log' || subscribeMode === 'noop') {
    if (subscribeMode === 'log') {
      console.info('[api/subscribe] Newsletter signup:', body.email);
    }

    const successResponse: SubscribeSuccessResponse = {
      ok: true,
      message: "Thanks for subscribing. We'll send updates soon."
    };
    return NextResponse.json(successResponse, { status: 200 });
  }

  // TODO: Add real provider integration (Mailchimp/HubSpot/ConvertKit) by mode.
  console.warn(`[api/subscribe] Unknown SUBSCRIBE_MODE "${subscribeMode}". Falling back to log mode.`);
  console.info('[api/subscribe] Newsletter signup:', body.email);
  const successResponse: SubscribeSuccessResponse = {
    ok: true,
    message: "Thanks for subscribing. We'll send updates soon."
  };
  return NextResponse.json(successResponse, { status: 200 });
}
