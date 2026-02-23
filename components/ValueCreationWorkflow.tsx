const workflowStages = [
  {
    stage: 'STAGE 1',
    title: 'Diligence',
    window: '0-30 days',
    points: ['Map critical leadership roles', 'Flag execution and culture risk', 'Prioritize day-one interventions']
  },
  {
    stage: 'STAGE 2',
    title: 'First 100 Days',
    window: 'Day 31-100',
    points: ['Confirm role clarity and mandates', 'Stand up weekly operating cadence', 'Launch 90-day intervention plan']
  },
  {
    stage: 'STAGE 3',
    title: 'Hold-Period Execution',
    window: 'Month 4+',
    points: ['Track delivery and leadership signals', 'Compare patterns across portfolio', 'Escalate support where momentum drops']
  },
  {
    stage: 'STAGE 4',
    title: 'Exit Readiness',
    window: '12-18 months pre-exit',
    points: ['Document value-creation evidence', 'Validate team resilience and bench', 'Prepare management narrative support']
  }
];

const signalBadges = ['Risk', 'Readiness', 'Momentum'];

export function ValueCreationWorkflow() {
  return (
    <section id="workflow-framework" className="section-shell scroll-mt-28 py-10 lg:py-12">
      {/* Modernized replacement for the original process visual, adapted for a clearer prototype narrative. */}
      <div className="surface-card p-7 md:p-9">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="section-title">Value creation support across the hold period</h2>
          <p className="body-copy mt-4">
            A simple operating framework from diligence through exit, with clear escalation points for risk, readiness, and momentum.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {workflowStages.map((stage) => (
            <article key={stage.title} className="rounded-md border border-brand-line bg-brand-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-green">{stage.stage}</p>
                <p className="text-[11px] text-brand-muted">{stage.window}</p>
              </div>
              <h3 className="mt-2 text-lg font-medium text-brand-ink">{stage.title}</h3>
              <ul className="mt-3 space-y-2 text-sm leading-[1.45] text-brand-muted">
                {stage.points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-green" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {signalBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-brand-greenLine bg-brand-greenTint px-3 py-1 text-xs font-medium text-brand-ink"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
