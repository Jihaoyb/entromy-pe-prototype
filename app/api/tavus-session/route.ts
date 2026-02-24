import { NextResponse } from 'next/server';
import { getServerConfig, validateTavusConfig } from '@/lib/server/serverConfig';

type TavusStage = 'env' | 'session_setup' | 'response_parse';

interface TavusSessionRequestBody {
  question?: string;
  originalQuestion?: string;
  triageAnswer?: string;
  recommendedNextStep?: string;
  recentTranscript?: Array<{
    role?: string;
    text?: string;
    source?: string;
    timestamp?: number;
  }>;
  context?: {
    source?: string;
    portfolioStage?: string;
    currentMode?: string;
    sessionId?: string;
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

// Assumes Tavus create-conversation returns conversation_id/id and conversation_url/url.
// TODO: switch to richer server-side session memory fields if Tavus exposes direct state sync APIs.

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
  if (payload.originalQuestion !== undefined && typeof payload.originalQuestion !== 'string') return false;
  if (payload.triageAnswer !== undefined && typeof payload.triageAnswer !== 'string') return false;
  if (payload.recommendedNextStep !== undefined && typeof payload.recommendedNextStep !== 'string') return false;
  if (payload.recentTranscript !== undefined) {
    if (!Array.isArray(payload.recentTranscript)) return false;
    for (const item of payload.recentTranscript) {
      if (!item || typeof item !== 'object') return false;
      const entry = item as Record<string, unknown>;
      if (entry.role !== undefined && typeof entry.role !== 'string') return false;
      if (entry.text !== undefined && typeof entry.text !== 'string') return false;
      if (entry.source !== undefined && typeof entry.source !== 'string') return false;
      if (entry.timestamp !== undefined && typeof entry.timestamp !== 'number') return false;
    }
  }
  if (payload.context !== undefined) {
    if (!payload.context || typeof payload.context !== 'object') return false;
    const context = payload.context as Record<string, unknown>;
    if (context.source !== undefined && typeof context.source !== 'string') return false;
    if (context.portfolioStage !== undefined && typeof context.portfolioStage !== 'string') return false;
    if (context.currentMode !== undefined && typeof context.currentMode !== 'string') return false;
    if (context.sessionId !== undefined && typeof context.sessionId !== 'string') return false;
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

  const originalQuestion =
    typeof payload.originalQuestion === 'string' && payload.originalQuestion.trim()
      ? payload.originalQuestion.trim().slice(0, 300)
      : typeof payload.question === 'string'
        ? payload.question.trim().slice(0, 300)
        : '';
  const triageAnswer = typeof payload.triageAnswer === 'string' ? payload.triageAnswer.trim().slice(0, 400) : '';
  const recommendedNextStep =
    typeof payload.recommendedNextStep === 'string' ? payload.recommendedNextStep.trim().slice(0, 220) : '';
  const recentTranscript = (payload.recentTranscript ?? [])
    .slice(-6)
    .map((entry) => ({
      role: typeof entry.role === 'string' ? entry.role.trim().slice(0, 20) : 'unknown',
      text: typeof entry.text === 'string' ? entry.text.trim().slice(0, 220) : '',
      source: typeof entry.source === 'string' ? entry.source.trim().slice(0, 30) : ''
    }))
    .filter((entry) => entry.text.length > 0);

  const contextLines = [
    originalQuestion ? `Original portfolio question: ${originalQuestion}` : '',
    triageAnswer ? `Triage answer summary: ${triageAnswer}` : '',
    recommendedNextStep ? `Recommended next step: ${recommendedNextStep}` : '',
    payload.context?.source ? `Source: ${payload.context.source}` : '',
    payload.context?.currentMode ? `Current mode: ${payload.context.currentMode}` : '',
    payload.context?.sessionId ? `Session ID: ${payload.context.sessionId}` : '',
    payload.context?.portfolioStage ? `Portfolio stage: ${payload.context.portfolioStage}` : ''
  ].filter(Boolean);
  const transcriptSummary = recentTranscript
    .map((entry) => `[${entry.role}${entry.source ? `/${entry.source}` : ''}] ${entry.text}`)
    .join('\n');

  const conversationalContext =
    contextLines.length > 0 || transcriptSummary
      ? [
          'You are supporting a private equity operating triage flow.',
          ...contextLines,
          transcriptSummary ? `Recent transcript:\n${transcriptSummary}` : ''
        ]
          .filter(Boolean)
          .join('\n')
      : 'You are supporting a private equity operating triage flow. Keep responses concise and action-oriented.';

  const endpoint = `${config.tavusBaseUrl.replace(/\/$/, '')}/v2/conversations`;
  const requestBody: Record<string, unknown> = {
    persona_id: config.tavusPersonaId,
    // Conversation context is app-owned session memory that keeps Tavus aligned with triage/audio state.
    conversational_context: conversationalContext
  };

  if (config.tavusReplicaId) {
    requestBody.replica_id = config.tavusReplicaId;
  }

  console.info('[api/tavus-session] creating session', {
    hasQuestion: Boolean(originalQuestion),
    hasTriageSummary: Boolean(triageAnswer),
    transcriptItems: recentTranscript.length,
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
    // TODO: add auth, rate limiting, telemetry, and stricter Tavus schema validation for production use.
    console.error('[api/tavus-session] failed to create Tavus session:', error);
    const errorResponse: TavusSessionErrorResponse = {
      ok: false,
      error: 'Tavus session setup failed due to an unexpected server error.',
      stage: 'session_setup'
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }
}
