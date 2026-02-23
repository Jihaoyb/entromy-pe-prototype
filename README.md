# Entromy Private Equity Prototype

## Project Overview
This project is a **Next.js + TypeScript + Tailwind CSS** one-page prototype that recreates the Entromy Private Equity page experience and adds a practical product concept: a guided **Ask + Video escalation** workflow for PE teams.

## What Was Cloned
- Entromy-style navbar, hero, and clean section rhythm
- PE narrative sections (Maximize Portfolio Value, outcomes, Why Entromy)
- Benefits row, workflow framework, CTA band, newsletter band, and multi-column footer
- Entromy-like green accent system and neutral enterprise UI styling

## What Was Improved
- Copy rewritten for **deal partners, operating partners, and portfolio ops teams**
- Messaging focused on diligence speed, leadership risk visibility, hold-period execution, and decision confidence
- Hero secondary CTA now links directly to the Agent prototype flow for faster concept discovery
- Added/expanded the prototype feature:
  - Ask a portfolio question
  - Receive a mocked advisor-style response
  - Escalate to either an instant AI video agent flow or a specialist 10-minute call flow

## Prototype vs Production
### Prototype/mock behavior
- Ask responses are simulated in the UI (no backend or LLM API call yet)
- Video modal scheduling choices are simulated (no meeting provider integration)

### Production-ready baseline
- Reusable section/component architecture
- Shared typography/container utilities
- Asset-based branding and icon wiring
- Responsive layout and baseline accessibility patterns

## Tech Stack
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS

## Run Locally
```bash
npm install
npm run dev
```

## Key Components
- `/Users/jihaoy/dev/entromy-pe-prototype/components/Navbar.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/HeroSection.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/SectionBlock.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/BenefitCard.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/ValueCreationWorkflow.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/AgentVideoModule.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/VideoChatModal.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/Footer.tsx`

## Where To Edit Copy
- Primary page copy and section data:
  - `/Users/jihaoy/dev/entromy-pe-prototype/data/pageContent.ts`
- Workflow stage language:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/ValueCreationWorkflow.tsx`
- Agent prompt chips and mocked response logic:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/AgentVideoModule.tsx`
- Modal escalation language:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/VideoChatModal.tsx`

## Assets In `/public`
- Brand: `company-logo.png`, `browser_tab.png`
- CTA icons: `mail.svg`, `statistic.svg`
- Benefit icons: `rapidly-eval.svg`, `leadership.svg`, `enhance-portfolio.svg`
- Hero visual: `meeting-placeholder.png` (with svg fallback in component)

## Suggested Next Steps
1. Connect Ask flow to a real advisor model/API and include source-cited recommendations.
2. Integrate real scheduling + video provider APIs for specialist escalation.
3. Add auth + workspace context for portfolio-specific recommendations.
