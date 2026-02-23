import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/server/serverConfig';

interface RealtimeSessionSuccessResponse {
  ok: true;
  clientSecret: string;
  model: string;
  voice: string;
}

interface RealtimeSessionErrorResponse {
  ok: false;
  error: string;
  stage: 'env' | 'session_setup' | 'token_parse';
}

interface OpenAIRealtimeSessionResponse {
  client_secret?: { value?: string } | string;
  clientSecret?: string;
  value?: string;
}

interface SessionEndpointConfig {
  label: 'sessions' | 'client_secrets';
  url: string;
  body: Record<string, unknown>;
}

const realtimeInstructions =
  'You are a PE operating triage agent. Keep guidance concise, practical, and focused on risk, readiness, and momentum.';

function sanitizeErrorText(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function extractClientSecret(payload: OpenAIRealtimeSessionResponse): string {
  if (typeof payload.client_secret === 'string' && payload.client_secret.trim()) {
    return payload.client_secret.trim();
  }
  if (payload.client_secret && typeof payload.client_secret === 'object' && typeof payload.client_secret.value === 'string') {
    return payload.client_secret.value.trim();
  }
  if (typeof payload.clientSecret === 'string' && payload.clientSecret.trim()) {
    return payload.clientSecret.trim();
  }
  if (typeof payload.value === 'string' && payload.value.trim()) {
    return payload.value.trim();
  }
  return '';
}

export async function POST() {
  const { openAiApiKey, openAiRealtimeModel, openAiRealtimeVoice } = getServerConfig();

  if (!openAiApiKey) {
    const missingKeyResponse: RealtimeSessionErrorResponse = {
      ok: false,
      error: 'OPENAI_API_KEY is not configured.',
      stage: 'env'
    };
    return NextResponse.json(missingKeyResponse, { status: 503 });
  }

  const endpoints: SessionEndpointConfig[] = [
    {
      label: 'sessions',
      url: 'https://api.openai.com/v1/realtime/sessions',
      body: {
        model: openAiRealtimeModel,
        voice: openAiRealtimeVoice,
        instructions: realtimeInstructions
      }
    },
    {
      label: 'client_secrets',
      url: 'https://api.openai.com/v1/realtime/client_secrets',
      body: {
        session: {
          type: 'realtime',
          model: openAiRealtimeModel,
          voice: openAiRealtimeVoice,
          instructions: realtimeInstructions
        }
      }
    }
  ];

  console.info('[api/realtime-session] start', {
    model: openAiRealtimeModel,
    voice: openAiRealtimeVoice
  });

  const endpointErrors: string[] = [];

  try {
    for (const endpoint of endpoints) {
      console.info('[api/realtime-session] requesting endpoint', { endpoint: endpoint.label });

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(endpoint.body)
      });

      if (!response.ok) {
        const errorText = sanitizeErrorText(await response.text());
        endpointErrors.push(`${endpoint.label}:${response.status}:${errorText}`);
        console.warn('[api/realtime-session] endpoint rejected request', {
          endpoint: endpoint.label,
          status: response.status
        });
        continue;
      }

      const data = (await response.json()) as OpenAIRealtimeSessionResponse;
      const clientSecret = extractClientSecret(data);

      if (!clientSecret) {
        endpointErrors.push(`${endpoint.label}:missing_client_secret`);
        console.warn('[api/realtime-session] endpoint response missing client secret', {
          endpoint: endpoint.label
        });
        continue;
      }

      console.info('[api/realtime-session] session ready', {
        endpoint: endpoint.label,
        hasClientSecret: clientSecret.length > 0
      });

      const successResponse: RealtimeSessionSuccessResponse = {
        ok: true,
        clientSecret,
        model: openAiRealtimeModel,
        voice: openAiRealtimeVoice
      };
      return NextResponse.json(successResponse, { status: 200 });
    }

    const errorResponse: RealtimeSessionErrorResponse = {
      ok: false,
      error: `Session setup failed. ${sanitizeErrorText(endpointErrors.join(' | ') || 'No compatible realtime endpoint responded.')}`,
      stage: endpointErrors.some((entry) => entry.includes('missing_client_secret')) ? 'token_parse' : 'session_setup'
    };
    return NextResponse.json(errorResponse, { status: 502 });
  } catch (error) {
    // TODO: Add auth, rate limiting, telemetry, and session auditing before production rollout.
    console.error('[api/realtime-session] Failed to create realtime session:', error);
    const errorResponse: RealtimeSessionErrorResponse = {
      ok: false,
      error: 'Session setup failed. Unexpected server error.',
      stage: 'session_setup'
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }
}
