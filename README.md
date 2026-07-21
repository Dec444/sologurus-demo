# Sologurus

Sologurus is an educational planning agent for self-directed language learners. It turns “I need IELTS 7.0 by December” into a verified test recommendation, local test-centre options, ten ranked YouTube teachers, a complete four-skill resource library, and three strategically different plans that stay inside the learner’s available time. Learners can choose from 16 target languages, open a connected Notion study database, open the connected Google Calendar schedule, or download a real `.ics` calendar file.

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

Open [http://localhost:3000](http://localhost:3000). Click **Use demo profile**, run the agent, select a plan, browse the complete research results, and download the calendar file. No API keys are needed for the core demo or standards-based calendar export.

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
                         Notion tasks + Google Calendar + ICS
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
- Sixteen target-language choices, with the English/IELTS demo researched in depth

## Demo vs. live integration

This repository ships the complete seeded experience, a connected Notion study database, six recurring Google Calendar series, and a working standards-based calendar export. The deployed demo links to the verified connected records. If `NOTION_TOKEN` and `NOTION_PARENT_PAGE_ID` are configured server-side, `POST /api/notion` also creates a new learner-specific page through the live Notion API. See [`.env.example`](./.env.example).

The calendar generator creates 12 dated study sessions plus three daily recurring reminder events in the learner's timezone. Its `.ics` output imports into Google, Apple, and Outlook Calendar without OAuth. `GOOGLE_CALENDAR_EVENT_URL` and `NOTION_DATABASE_URL` expose the verified demo connections without placing credentials in the browser.

Out of scope for this hackathon build: authentication, multi-user accounts, two-way Notion sync, adaptive re-planning, placement testing, native mobile apps, payments, analytics, and monitoring.

## Submission checklist

- [x] Working seeded project
- [x] Education category and project description
- [x] Zero-key judge path
- [x] 16-language target selector
- [x] Live Notion database connection
- [x] Live recurring Google Calendar schedule
- [x] Universal calendar export
- [x] Setup and architecture documentation
- [x] MIT license
- [x] Under-three-minute demo script
- [ ] Add the public YouTube demo URL
- [ ] Add the Codex `/feedback` session ID to Devpost

## License

MIT — see [`LICENSE`](./LICENSE).
