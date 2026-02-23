'use client';

import { useEffect, useState } from 'react';

interface AiVideoAgentModalProps {
  open: boolean;
  question: string;
  onClose: () => void;
  onEscalateToSpecialist: () => void;
}

const followUpOptions = ['Show me a 30-day plan', 'What should I validate first?', 'When should I escalate this?'] as const;

const followUpResponses: Record<(typeof followUpOptions)[number], string> = {
  'Show me a 30-day plan':
    'Weeks 1-2: lock role clarity and decision rights. Weeks 3-4: run weekly cadence reviews tied to the top two value-creation priorities.',
  'What should I validate first?':
    'Validate ownership for critical milestones, leadership coverage in high-risk functions, and dependency risk across teams before adding new initiatives.',
  'When should I escalate this?':
    'Escalate when two cadence cycles slip, decision latency increases, or key leaders are blocked on cross-functional dependencies.'
};

interface TriageApiSuccess {
  ok: true;
  answer: string;
  recommendedNextStep: string;
  mode: 'live' | 'fallback';
}

interface TriageApiFailure {
  ok: false;
  error: string;
}

export function AiVideoAgentModal({ open, question, onClose, onEscalateToSpecialist }: AiVideoAgentModalProps) {
  const [transcript, setTranscript] = useState<string[]>([
    'AI Agent: I can help triage this quickly and suggest a practical next step for your deal or operating team.'
  ]);
  const [isFollowUpLoading, setIsFollowUpLoading] = useState(false);

  const handleFollowUp = async (option: (typeof followUpOptions)[number]) => {
    if (isFollowUpLoading) return;

    setTranscript((prev) => [...prev, `You: ${option}`]);
    setIsFollowUpLoading(true);

    try {
      const combinedQuestion = question.trim() ? `${question.trim()} Follow-up: ${option}` : option;

      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: combinedQuestion,
          context: { source: 'ai-video-modal' }
        })
      });

      const data = (await response.json()) as TriageApiSuccess | TriageApiFailure;
      if (!response.ok || !data.ok) {
        throw new Error('AI video follow-up request failed.');
      }

      setTranscript((prev) => [...prev, `AI Agent: ${data.answer}`, `AI Agent Next step: ${data.recommendedNextStep}`]);
    } catch (error) {
      console.error('[AiVideoAgentModal] Failed to fetch follow-up response:', error);
      setTranscript((prev) => [...prev, `AI Agent: ${followUpResponses[option]}`]);
    } finally {
      setIsFollowUpLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setTranscript(['AI Agent: I can help triage this quickly and suggest a practical next step for your deal or operating team.']);
      setIsFollowUpLoading(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-3xl rounded-xl border border-brand-line bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-video-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="ai-video-title" className="text-xl font-medium text-brand-ink">
              Start AI video agent (2 min)
            </h3>
            <p className="mt-1.5 text-sm leading-[1.5] text-brand-muted">
              Ask a quick follow-up and get a guided PE-focused recommendation before escalating to a specialist.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-brand-line px-2 py-1 text-xs text-brand-muted transition hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            aria-label="Close AI video agent modal"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-md border border-brand-line bg-brand-panel p-4">
            <div className="relative overflow-hidden rounded-md border border-brand-line bg-[#1f2520] aspect-[16/10]">
              <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white">
                <span className="h-2 w-2 rounded-full bg-[#71e440] animate-pulse" />
                <span>AI Agent • Live</span>
              </div>
              <div className="absolute left-3 top-10 text-[11px] text-slate-200">PE triage mode</div>
              <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                <span className="h-2 w-1 rounded bg-[#9fd67b] animate-pulse" />
                <span className="h-4 w-1 rounded bg-[#9fd67b] animate-pulse [animation-delay:120ms]" />
                <span className="h-3 w-1 rounded bg-[#9fd67b] animate-pulse [animation-delay:240ms]" />
                <span className="h-5 w-1 rounded bg-[#9fd67b] animate-pulse [animation-delay:360ms]" />
              </div>
            </div>

            <div className="mt-3 rounded-md border border-brand-line bg-white p-3">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Your question</p>
              <p className="mt-1 text-sm leading-[1.5] text-brand-ink">
                {question.trim() || 'No question provided. Return to the triage panel to add context.'}
              </p>
            </div>
          </div>

          <div className="rounded-md border border-brand-line bg-white p-4">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-muted">Suggested follow-ups</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {followUpOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleFollowUp(option)}
                  disabled={isFollowUpLoading}
                  className="rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs text-brand-muted transition-colors hover:bg-brand-greenTint hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="mt-3 min-h-[170px] rounded-md border border-dashed border-brand-line bg-brand-panel p-3 text-sm leading-[1.55] text-brand-muted" aria-live="polite">
              {transcript.map((line, index) => (
                <p key={`${line}-${index}`} className={index > 0 ? 'mt-2' : undefined}>
                  {line}
                </p>
              ))}
              {isFollowUpLoading ? <p className="mt-2 text-brand-muted/90">AI Agent: Reviewing your follow-up...</p> : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-brand-line px-4 py-2.5 text-[13px] font-medium text-brand-muted transition-colors hover:bg-brand-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            End session
          </button>
          <button
            type="button"
            onClick={onEscalateToSpecialist}
            className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            Escalate to specialist
          </button>
        </div>
      </div>
    </div>
  );
}
