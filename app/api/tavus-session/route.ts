import { NextResponse } from 'next/server';
import { getServerConfig, validateTavusConfig } from '@/lib/server/serverConfig';

type TavusStage = 'env' | 'session_setup' | 'response_parse';

interface TavusSessionRequestBody {
  question?: string;
  context?: {
    source?: string;
    portfolioStage?: string;
  };
}

interface TavusSessionSuccessResponse {
  ok: true;
  conversationId: string;
  conversationUrl: string;
  mode: 'live';
}

interface TavusSessionErrorResponse {
  ok: false;
  error: string;
  stage: TavusStage;
}

interface TavusConversationResponse {
  conversation_id?: string;
  id?: string;
  conversation_url?: string;
  url?: string;
}

function sanitizeErrorText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

function parseConversationResponse(payload: TavusConversationResponse) {
  const conversationId = (payload.conversation_id ?? payload.id ?? '').trim();
  const conversationUrl = (payload.conversation_url ?? payload.url ?? '').trim();
  return { conversationId, conversationUrl };
}

function isValidRequestPayload(value: unknown): value is TavusSessionRequestBody {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;

  if (payload.question !== undefined && typeof payload.question !== 'string') return false;
  if (payload.context !== undefined) {
    if (!payload.context || typeof payload.context !== 'object') return false;
    const context = payload.context as Record<string, unknown>;
    if (context.source !== undefined && typeof context.source !== 'string') return false;
    if (context.portfolioStage !== undefined && typeof context.portfolioStage !== 'string') return false;
  }

  return true;
}

export async function POST(request: Request) {
  const config = getServerConfig();
  const validation = validateTavusConfig(config);

  if (!validation.ok) {
    const errorResponse: TavusSessionErrorResponse = {
      ok: false,
      error: `Missing Tavus configuration: ${validation.missing.join(', ')}`,
      stage: 'env'
    };
    return NextResponse.json(errorResponse, { status: 503 });
  }

  let payload: TavusSessionRequestBody = {};
  try {
    const parsed = (await request.json()) as unknown;
    if (!isValidRequestPayload(parsed)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid tavus session payload.',
          stage: 'session_setup'
        } satisfies TavusSessionErrorResponse,
        { status: 400 }
      );
    }
    payload = parsed;
  } catch {
    payload = {};
  }

  const triageQuestion = typeof payload.question === 'string' ? payload.question.trim().slice(0, 300) : '';
  const contextLines = [
    triageQuestion ? `Original portfolio question: ${triageQuestion}` : '',
    payload.context?.source ? `Source: ${payload.context.source}` : '',
    payload.context?.portfolioStage ? `Portfolio stage: ${payload.context.portfolioStage}` : ''
  ].filter(Boolean);

  const conversationalContext =
    contextLines.length > 0
      ? `You are supporting a private equity operating triage flow.\n${contextLines.join('\n')}`
      : 'You are supporting a private equity operating triage flow. Keep responses concise and action-oriented.';

  const endpoint = `${config.tavusBaseUrl.replace(/\/$/, '')}/v2/conversations`;
  const requestBody: Record<string, unknown> = {
    persona_id: config.tavusPersonaId,
    conversational_context: conversationalContext
  };

  if (config.tavusReplicaId) {
    requestBody.replica_id = config.tavusReplicaId;
  }

  console.info('[api/tavus-session] creating session', {
    hasQuestion: Boolean(triageQuestion),
    hasReplica: Boolean(config.tavusReplicaId)
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.tavusApiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = sanitizeErrorText(await response.text());
      const errorResponse: TavusSessionErrorResponse = {
        ok: false,
        error: `Tavus session setup failed: ${errorText}`,
        stage: 'session_setup'
      };
      return NextResponse.json(errorResponse, { status: 502 });
    }

    const data = (await response.json()) as TavusConversationResponse;
    const { conversationId, conversationUrl } = parseConversationResponse(data);

    if (!conversationId || !conversationUrl) {
      const errorResponse: TavusSessionErrorResponse = {
        ok: false,
        error: 'Tavus response did not include conversation_id or conversation_url.',
        stage: 'response_parse'
      };
      return NextResponse.json(errorResponse, { status: 502 });
    }

    const successResponse: TavusSessionSuccessResponse = {
      ok: true,
      conversationId,
      conversationUrl,
      mode: 'live'
    };
    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    // TODO: add auth, rate limiting, telemetry, and stricter request validation for production use.
    console.error('[api/tavus-session] failed to create Tavus session:', error);
    const errorResponse: TavusSessionErrorResponse = {
      ok: false,
      error: 'Tavus session setup failed due to an unexpected server error.',
      stage: 'session_setup'
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }
}
