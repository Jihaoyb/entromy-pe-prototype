import { NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/server/serverConfig';
import { buildFallbackTriage } from '@/lib/server/triageFallback';

type TriageSource = 'agent-panel' | 'ai-video-modal';

interface TriageRequestBody {
  question: string;
  context?: {
    source?: TriageSource;
    portfolioStage?: string;
  };
}

interface TriageSuccessResponse {
  ok: true;
  answer: string;
  recommendedNextStep: string;
  mode: 'live' | 'fallback';
}

interface TriageErrorResponse {
  ok: false;
  error: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function parseAndValidatePayload(payload: unknown): TriageRequestBody | null {
  if (!payload || typeof payload !== 'object') return null;

  const maybeBody = payload as Partial<TriageRequestBody>;
  if (typeof maybeBody.question !== 'string') return null;

  const question = maybeBody.question.trim();
  if (!question) return null;

  const context = maybeBody.context && typeof maybeBody.context === 'object' ? maybeBody.context : undefined;

  return {
    question,
    context: {
      source: context?.source === 'ai-video-modal' ? 'ai-video-modal' : context?.source === 'agent-panel' ? 'agent-panel' : undefined,
      portfolioStage: typeof context?.portfolioStage === 'string' ? context.portfolioStage.trim() : undefined
    }
  };
}

function buildPrompt(body: TriageRequestBody): string {
  const contextLines = [
    body.context?.source ? `Source: ${body.context.source}` : '',
    body.context?.portfolioStage ? `Portfolio stage: ${body.context.portfolioStage}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  return `Question:\n${body.question}\n\n${contextLines ? `Context:\n${contextLines}\n\n` : ''}Return JSON with keys "answer" and "recommendedNextStep".`;
}

async function generateLiveTriage(body: TriageRequestBody, apiKey: string, model: string) {
  const systemPrompt =
    'You are a private equity diligence and operating triage assistant for deal and operating partners. Be concise and practical. Prioritize risk timing, ownership, and immediate next action. Keep "answer" to 2-3 short sentences in plain text and avoid generic AI phrasing. Keep "recommendedNextStep" to one short action-oriented sentence.';

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: buildPrompt(body) }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI response did not include content.');

  let parsed: { answer?: unknown; recommendedNextStep?: unknown } | null = null;
  try {
    parsed = JSON.parse(content) as { answer?: unknown; recommendedNextStep?: unknown };
  } catch {
    throw new Error('Failed to parse OpenAI JSON response.');
  }

  const answer = typeof parsed.answer === 'string' ? parsed.answer.trim() : '';
  const recommendedNextStep = typeof parsed.recommendedNextStep === 'string' ? parsed.recommendedNextStep.trim() : '';

  if (!answer || !recommendedNextStep) {
    throw new Error('OpenAI response missing required fields.');
  }

  return { answer, recommendedNextStep };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    const errorResponse: TriageErrorResponse = { ok: false, error: 'Invalid JSON payload.' };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const body = parseAndValidatePayload(payload);
  if (!body) {
    const errorResponse: TriageErrorResponse = { ok: false, error: 'Question is required.' };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  const { openAiApiKey, openAiModel } = getServerConfig();

  if (!openAiApiKey) {
    const fallback = buildFallbackTriage(body.question);
    const fallbackResponse: TriageSuccessResponse = { ok: true, ...fallback, mode: 'fallback' };
    return NextResponse.json(fallbackResponse, { status: 200 });
  }

  try {
    const live = await generateLiveTriage(body, openAiApiKey, openAiModel);
    const successResponse: TriageSuccessResponse = { ok: true, ...live, mode: 'live' };
    return NextResponse.json(successResponse, { status: 200 });
  } catch (error) {
    // Keep demo behavior stable by falling back to local triage logic when AI is unavailable.
    console.error('[api/triage] Falling back due to live AI error:', error);
    const fallback = buildFallbackTriage(body.question);
    const fallbackResponse: TriageSuccessResponse = { ok: true, ...fallback, mode: 'fallback' };
    return NextResponse.json(fallbackResponse, { status: 200 });
  }
}
