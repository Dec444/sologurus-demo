# Sologurus

Sologurus is an educational planning agent for self-directed language learners. It turns “I need IELTS 7.0 by December” into a verified test recommendation, free-first resources, and three strategically different plans that stay inside the learner’s available time. The included seeded demo requires no API keys and produces a real `.ics` calendar file.

Built for the **Education** category of OpenAI Build Week with Codex and GPT-5.6.

## Demo video

Add the public YouTube URL here before submission. The complete recording script is in [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

## Quickstart

Requirements: Node.js 22.13 or newer.

```bash
git clone <your-repository-url>
cd Sologurus
npm install
npm run demo
```

Open [http://localhost:3000](http://localhost:3000). Click **Use demo profile**, run the agent, select a plan, and download the calendar file. No API keys are needed.

```bash
npm run build
npm test
```

## Sample data

- Language: English
- Level: B1 / intermediate
- Location: Ho Chi Minh City, Vietnam
- Goal: IELTS 7.0 for Canadian permanent residence
- Target: December 5, 2026
- Availability: 8 hours per week

## How it works

```text
Learner profile
     ↓
GPT-5.6 planner / orchestrator
     ├── search_tests()       → test choices and official-source records
     ├── rank_guidance()      → channels and communities with rationale
     ├── curate_resources()   → free-first four-skill resources
     └── generate_plans()     → three strategies + constraint check
                                  ↓
                         Notion-ready tasks + ICS calendar
```

The core architectural decision is **structured tools over free-text planning**. Each step produces predictable records; the planner composes those objects into schedules and checks that total minutes do not exceed the learner’s declared availability.

## How Codex accelerated the build

Codex translated the PRD into the working responsive experience, scaffolded the orchestration states, implemented the dependency-free ICS emitter, wrote the seeded judge path, and generated the deployment/readme/demo assets in one build session. The most valuable acceleration was turning several hours of UI, export, and validation boilerplate into a focused implementation pass while keeping human product decisions explicit.

## How GPT-5.6 is used

In live mode, GPT-5.6 is the planner over the structured tools: it decides which lookup to call, ranks resources for the learner’s level and goal, synthesizes three plans by strategy rather than intensity, and checks the result against the weekly time constraint. The public demo uses deterministic fixtures so judges can test the entire product without credentials or flaky live search.

## Human decisions

- Structured tool results instead of a free-text study-plan prompt
- Three plan strategies, not “light / medium / heavy” intensity tiers
- ICS first, so calendar export works without OAuth setup
- One showcase language in depth instead of ten shallow languages

## Demo vs. live integration

This repository ships the complete seeded experience and working calendar export. Live search, Notion writes, and optional Google Calendar API wiring are represented by clear integration boundaries but are intentionally not enabled in the public demo. A production version would add server-side secrets, OAuth, schema validation, source freshness checks, and failure recovery.

Out of scope for this hackathon build: authentication, multi-user accounts, two-way Notion sync, adaptive re-planning, placement testing, native mobile apps, payments, analytics, and monitoring.

## Submission checklist

- [x] Working seeded project
- [x] Education category and project description
- [x] Zero-key judge path
- [x] Calendar export
- [x] Setup and architecture documentation
- [x] MIT license
- [x] Under-three-minute demo script
- [ ] Add the public YouTube demo URL
- [ ] Add the Codex `/feedback` session ID to Devpost

## License

MIT — see [`LICENSE`](./LICENSE).
