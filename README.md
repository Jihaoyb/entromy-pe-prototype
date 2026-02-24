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
- All **Book Demo** actions now open Calendly in a new tab
- Specialist escalation now routes to Calendly for live session booking
- Added backend API routes for triage (`/api/triage`) and subscribe (`/api/subscribe`)
- Added a realtime session bootstrap route (`/api/realtime-session`) for ephemeral AI audio sessions
- Added/expanded the prototype feature:
  - Ask a portfolio question
  - Receive a concise PE-style response from server-side AI (with fallback mode)
  - Escalate to either an instant AI video agent flow or a Calendly specialist booking flow

## Prototype vs Production
### Prototype/mock behavior
- AI video agent modal keeps the prototype shell UI and now includes a feature-flagged realtime audio path
- Subscribe mode defaults to `log` (server logs emails; no ESP integration yet)
### Realtime status
- Realtime audio mode is feature-flagged in the AI video modal.
- When unavailable, the modal automatically falls back to prototype transcript mode.
- Feature flag to enable in Vercel: `NEXT_PUBLIC_ENABLE_REALTIME_AGENT=true` (client-side env var, required).
- Fallback messages now include a stage hint, for example: `Realtime unavailable (session setup failed). Using prototype mode.`

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

## Environment Variables
Create `.env.local` with:

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4.1-mini
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_VOICE=marin
NEXT_PUBLIC_ENABLE_REALTIME_AGENT=true
SUBSCRIBE_MODE=log
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/entromy-team/initial-demo
```

- `OPENAI_API_KEY`: enables live triage responses from `/api/triage`.
- `OPENAI_MODEL` (optional): defaults to `gpt-4.1-mini`.
- `OPENAI_REALTIME_MODEL` (optional): realtime model for `/api/realtime-session`.
- `OPENAI_REALTIME_VOICE` (optional): realtime voice profile.
- `NEXT_PUBLIC_ENABLE_REALTIME_AGENT`: enables the client realtime connect path in the AI modal.
- `SUBSCRIBE_MODE` (optional): `log` (default) logs newsletter signups server-side.
- `NEXT_PUBLIC_CALENDLY_URL` (optional): overrides the default shared Calendly link.

If `OPENAI_API_KEY` is missing or AI calls fail, `/api/triage` returns a strong fallback response with `mode: "fallback"` so the demo remains usable.

## API Routes
- `POST /api/triage`
  - Request: `{ question: string, context?: { source?: "agent-panel" | "ai-video-modal", portfolioStage?: string } }`
  - Response: `{ ok: true, answer: string, recommendedNextStep: string, mode: "live" | "fallback" }`
  - Returns `400` on invalid payload.
- `POST /api/subscribe`
  - Request: `{ email: string }`
  - Response: `{ ok: true, message: string }` or `{ ok: false, error: string }`
  - Uses stronger validation (no whitespace, normalized shape, 2+ letter TLD) in both client and server.
  - In `log` mode, email is logged server-side for demo use.
- `POST /api/realtime-session`
  - Creates a server-side ephemeral realtime token for browser WebRTC usage.
  - Never exposes `OPENAI_API_KEY` to the client.
  - Returns graceful errors so UI can fall back to prototype mode.
- `POST /api/events`
  - Lightweight demo instrumentation endpoint (logs allowed UI events server-side).
  - No DB persistence; useful for validating interaction flow during demos.

## Key Components
- `/Users/jihaoy/dev/entromy-pe-prototype/components/Navbar.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/HeroSection.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/SectionBlock.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/BenefitCard.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/ValueCreationWorkflow.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/AgentVideoModule.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/AiVideoAgentModal.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/components/Footer.tsx`
- `/Users/jihaoy/dev/entromy-pe-prototype/app/api/triage/route.ts`
- `/Users/jihaoy/dev/entromy-pe-prototype/app/api/subscribe/route.ts`
- `/Users/jihaoy/dev/entromy-pe-prototype/app/api/realtime-session/route.ts`

## Where To Edit Copy
- Primary page copy and section data:
  - `/Users/jihaoy/dev/entromy-pe-prototype/data/pageContent.ts`
- Workflow stage language:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/ValueCreationWorkflow.tsx`
- Agent prompt chips and mocked response logic:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/AgentVideoModule.tsx`
- AI video prototype modal language:
  - `/Users/jihaoy/dev/entromy-pe-prototype/components/AiVideoAgentModal.tsx`
- Shared booking URL:
  - `/Users/jihaoy/dev/entromy-pe-prototype/data/siteConfig.ts`
- Server env and fallback logic:
  - `/Users/jihaoy/dev/entromy-pe-prototype/lib/server/serverConfig.ts`
  - `/Users/jihaoy/dev/entromy-pe-prototype/lib/server/triageFallback.ts`
- Shared email validator:
  - `/Users/jihaoy/dev/entromy-pe-prototype/lib/validation/email.ts`

## Assets In `/public`
- Brand: `company-logo.png`, `browser_tab.png`
- CTA icons: `mail.svg`, `statistic.svg`
- Benefit icons: `rapidly-eval.svg`, `leadership.svg`, `enhance-portfolio.svg`
- Hero visual: `meeting-placeholder.png` (with svg fallback in component)

## Suggested Next Steps
1. Connect Ask flow to a real advisor model/API and include source-cited recommendations.
2. Add auth/rate-limiting and request telemetry for `/api/triage` and `/api/realtime-session`.
3. Add auth + workspace context for portfolio-specific recommendations.
