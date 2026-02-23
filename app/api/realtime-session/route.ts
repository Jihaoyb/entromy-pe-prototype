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
}

interface OpenAIRealtimeSessionResponse {
  client_secret?: {
    value?: string;
  };
}

export async function POST() {
  const { openAiApiKey, openAiRealtimeModel, openAiRealtimeVoice } = getServerConfig();

  if (!openAiApiKey) {
    const missingKeyResponse: RealtimeSessionErrorResponse = {
      ok: false,
      error: 'Realtime mode is unavailable because OPENAI_API_KEY is not configured.'
    };
    return NextResponse.json(missingKeyResponse, { status: 503 });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: openAiRealtimeModel,
          voice: openAiRealtimeVoice,
          instructions:
            'You are a PE operating triage agent. Keep guidance concise, practical, and focused on risk, readiness, and momentum.'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Realtime session request failed with status ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const data = (await response.json()) as OpenAIRealtimeSessionResponse;
    const clientSecret = data.client_secret?.value?.trim();
    if (!clientSecret) {
      throw new Error('OpenAI realtime response did not include a client secret.');
    }

    const successResponse: RealtimeSessionSuccessResponse = {
      ok: true,
      clientSecret,
      model: openAiRealtimeModel,
      voice: openAiRealtimeVoice
    };
    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    // TODO: Add auth, rate limiting, telemetry, and session auditing before production rollout.
    console.error('[api/realtime-session] Failed to create realtime session:', error);
    const errorResponse: RealtimeSessionErrorResponse = {
      ok: false,
      error: 'Unable to create realtime session right now. Please use prototype mode.'
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }
}
