export interface TriageFallbackResult {
  answer: string;
  recommendedNextStep: string;
}

interface ResponsePattern {
  keywords: string[];
  answer: string;
  recommendedNextStep: string;
}

const responsePatterns: ResponsePattern[] = [
  {
    keywords: ['ceo', 'transition', 'new leader'],
    answer:
      'Stabilize the first 30 days with explicit decision rights, role clarity, and a weekly operating review tied to value-creation priorities. This reduces leadership transition drag before it impacts delivery.',
    recommendedNextStep: 'Run a 2-week CEO transition checkpoint with deal and operating partners.'
  },
  {
    keywords: ['first 100', '100 days', 'post-close', 'first 30'],
    answer:
      'Focus early on leadership role-fit, operating cadence, and execution blockers linked to the investment thesis. Keep interventions narrow and owner-based so decisions can move quickly.',
    recommendedNextStep: 'Set a 100-day plan review with owners, milestones, and escalation triggers.'
  },
  {
    keywords: ['leadership', 'team', 'readiness', 'role fit'],
    answer:
      'Use a consistent leadership scorecard across role fit, bench strength, and execution reliability. Prioritize gaps where weak leadership coverage directly threatens top value levers.',
    recommendedNextStep: 'Align on a cross-portfolio leadership scorecard and review cadence.'
  },
  {
    keywords: ['cadence', 'slipping', 'execution', 'missed'],
    answer:
      'When execution cadence slips, the root cause is often ownership ambiguity, weak milestone quality, or unresolved dependencies. Address those first before adding initiatives.',
    recommendedNextStep: 'Run a 14-day cadence reset and escalate any unresolved dependencies.'
  },
  {
    keywords: ['portfolio', 'compare', 'cross-portfolio', 'benchmark'],
    answer:
      'Compare companies using one framework for leadership risk, execution momentum, and intervention responsiveness. That makes support allocation faster and more defensible.',
    recommendedNextStep: 'Review portfolio heatmap rankings with operating partners this week.'
  },
  {
    keywords: ['exit', 'readiness', 'pre-exit', 'sale'],
    answer:
      'In pre-exit periods, validate leadership resilience and document execution proof points tied to the value-creation narrative. This improves buyer confidence and management consistency.',
    recommendedNextStep: 'Run an exit-readiness diagnostic focused on leadership stability and delivery evidence.'
  }
];

export function buildFallbackTriage(question: string): TriageFallbackResult {
  const normalized = question.toLowerCase();
  const match = responsePatterns.find((pattern) => pattern.keywords.some((keyword) => normalized.includes(keyword)));

  if (match) {
    return { answer: match.answer, recommendedNextStep: match.recommendedNextStep };
  }

  return {
    answer:
      'Start with a rapid baseline of leadership risk and execution friction, then prioritize interventions by business impact and urgency. Keep owners and milestones explicit so momentum is visible week to week.',
    recommendedNextStep: 'Schedule a 30-minute diagnostic to align interventions, owners, and escalation thresholds.'
  };
}
