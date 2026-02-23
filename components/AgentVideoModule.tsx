'use client';

import { useState } from 'react';
import { AiVideoAgentModal } from '@/components/AiVideoAgentModal';
import { CALENDLY_URL } from '@/data/siteConfig';

const suggestedPrompts = [
  'How should we de-risk a new CEO transition?',
  'What should we assess in the first 30 days post-close?',
  'How do we compare leadership risk across portfolio companies?',
  'What signals suggest execution cadence is slipping?'
];

interface ResponsePattern {
  id: string;
  keywords: string[];
  response: string;
}

const responsePatterns: ResponsePattern[] = [
  {
    id: 'ceo-transition',
    keywords: ['ceo', 'transition', 'lead change'],
    response:
      'Start with role clarity and decision rights in the first two weeks, then align weekly operating reviews to the top value-creation levers. This stabilizes execution during leadership change and reduces avoidable escalation.'
  },
  {
    id: 'first-100-days',
    keywords: ['first 100', '100 days', 'post-close', 'first 30'],
    response:
      'In the first 100 days, prioritize leadership role-fit, cadence quality, and blockers tied to the investment thesis. Capture owners and timelines in a short intervention plan so partners can move quickly.'
  },
  {
    id: 'leadership-assessment',
    keywords: ['leadership', 'team', 'role fit', 'capability'],
    response:
      'Use one leadership scorecard across role fit, bench strength, and execution reliability. Sequence interventions by business impact so the most material gaps are addressed first.'
  },
  {
    id: 'operating-cadence',
    keywords: ['cadence', 'slipping', 'execution', 'missed'],
    response:
      'When cadence slips, check ownership clarity, milestone quality, and unresolved cross-functional dependencies before adding new workstreams. A 14-day cadence reset with tighter checkpoints usually restores momentum.'
  },
  {
    id: 'portfolio-comparison',
    keywords: ['compare', 'portfolio', 'across companies', 'cross-portfolio'],
    response:
      'Compare assets with a common scorecard for leadership stability, operating rhythm, and intervention responsiveness. This helps operating partners direct support where delay drives the highest value leakage risk.'
  },
  {
    id: 'exit-readiness',
    keywords: ['exit', 'readiness', 'sale process', 'pre-exit'],
    response:
      'In pre-exit planning, validate leadership resilience and document execution proof points tied to the value-creation narrative. This strengthens management confidence and sponsor positioning.'
  }
];

function buildMockResponse(question: string) {
  const normalized = question.toLowerCase();
  const match = responsePatterns.find((pattern) => pattern.keywords.some((keyword) => normalized.includes(keyword)));

  if (match) return match.response;

  return 'Start with a rapid baseline of leadership and execution risk, then map blockers to near-term value priorities. Assign targeted interventions with clear owners and review progress weekly until momentum is stable.';
}

export function AgentVideoModule() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasResponse, setHasResponse] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [aiVideoModalOpen, setAiVideoModalOpen] = useState(false);

  const canAsk = question.trim().length > 0 && !isLoading;

  // Prototype-only interaction: this simulates quick PE triage before specialist escalation.
  const handleAsk = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;

    setIsLoading(true);
    setHasResponse(false);

    await new Promise((resolve) => setTimeout(resolve, 800));

    setResponseText(buildMockResponse(trimmedQuestion));
    setHasResponse(true);
    setIsLoading(false);
  };

  const handleEscalateFromAiVideo = () => {
    window.open(CALENDLY_URL, '_blank', 'noopener,noreferrer');
    setAiVideoModalOpen(false);
  };

  return (
    <section id="agent-module" className="section-shell scroll-mt-28 py-10 lg:py-12">
      <div className="surface-card p-6 md:p-7">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-muted">Prototype Concept</p>
          <h2 className="mt-2 text-2xl font-medium leading-[1.25] text-brand-ink md:text-3xl">Talk to an Entromy Agent</h2>
          <p className="mt-3 body-copy">
            Ask a portfolio question, get a fast recommendation, then escalate to a specialist video session when needed.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[11px] text-brand-muted">Fast triage</span>
          <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[11px] text-brand-muted">PE-focused</span>
          <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-[11px] text-brand-muted">Specialist escalation</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setQuestion(prompt)}
              className="rounded-full border border-brand-line bg-white px-3 py-1.5 text-xs text-brand-muted transition-colors hover:bg-brand-greenTint hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-md border border-brand-line bg-brand-panel p-[18px]">
            <label htmlFor="quick-question" className="text-sm font-medium text-brand-ink">
              Your question
            </label>
            <input
              id="quick-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-2 w-full rounded-md border border-brand-line bg-white px-3.5 py-2.5 text-sm text-brand-ink outline-none ring-brand-green placeholder:text-[#8a8a8a] focus:ring-2"
              placeholder="How should we de-risk a new CEO transition in the first 120 days?"
              aria-label="Ask an Entromy portfolio question"
            />
            <button
              type="button"
              onClick={handleAsk}
              disabled={!canAsk}
              className="mt-3 rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:bg-[#89b86a]"
            >
              {isLoading ? 'Generating recommendation...' : 'Ask a quick question'}
            </button>
          </div>

          <div className="rounded-md border border-brand-line bg-white p-[18px]">
            <p className="text-sm font-medium text-brand-ink">Mocked response</p>
            <div
              className="mt-2.5 min-h-[168px] rounded-md border border-dashed border-brand-line bg-brand-panel p-3.5 text-sm leading-[1.58] text-brand-muted"
              aria-live="polite"
            >
              {isLoading
                ? 'Reviewing portfolio context and preparing a recommendation...'
                : hasResponse
                  ? responseText
                  : 'Submit a question to preview a concise advisory response.'}
            </div>

            {hasResponse && !isLoading ? (
              <>
                <p className="mt-3 text-xs leading-[1.5] text-brand-muted">
                  Recommended next step: Review this with an Entromy specialist and align on a 30-minute diagnostic or a
                  10-minute triage call.
                </p>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAiVideoModalOpen(true)}
                    className="rounded-md bg-brand-green px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  >
                    Start AI video agent (2 min)
                  </button>
                  <a
                    href={CALENDLY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-brand-green px-4 py-2.5 text-[13px] font-medium text-brand-green transition-colors hover:bg-brand-greenTint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                  >
                    Talk to a specialist (10 min)
                  </a>
                </div>
                <div className="mt-2 space-y-1 text-xs text-brand-muted">
                  <p>Best for a quick walkthrough or clarification: AI video agent.</p>
                  <p>Best for deal-specific questions, portfolio context, or urgent operating decisions: specialist call.</p>
                  <p>Opens Calendly to request a live specialist session.</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <AiVideoAgentModal
        open={aiVideoModalOpen}
        question={question}
        onClose={() => setAiVideoModalOpen(false)}
        onEscalateToSpecialist={handleEscalateFromAiVideo}
      />
    </section>
  );
}
