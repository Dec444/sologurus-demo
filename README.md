<div align="center">

![Sologurus — one goal, a plan you can actually follow](public/og.png)

# Sologurus

**A self-directed language-learning agent that turns a goal into evidence, strategy, and scheduled action.**

[Live demo](https://sologurus-study-agent.lu-liu398220.chatgpt.site) · [Demo script](DEMO_SCRIPT.md) · [Devpost submission](DEVPOST_SUBMISSION.md) · [Product spec](sologurus-hackathon-prd.md)

[![CI](https://github.com/Dec444/sologurus-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/Dec444/sologurus-demo/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-5FA04E?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-8A7CFB.svg)](LICENSE)

</div>

## Why Sologurus

Language learners rarely lack motivation; they lack a system. Choosing an exam, checking test centers, evaluating teachers, finding materials for every skill, and fitting it all into a real week can become a second job.

Sologurus turns a learner's language, level, location, goal, deadline, and weekly availability into a transparent study system. It shows the evidence behind its recommendations, offers three genuinely different strategies, checks the learner's time budget, and sends the chosen plan to tools they already use.

> **Hackathon scope:** the public judge path is a deterministic English/IELTS scenario, so the complete experience works without API keys or flaky live search. The product keeps explicit integration boundaries for live retrieval and learner-specific writes.

## Try the demo

Open the [live Sologurus demo](https://sologurus-study-agent.lu-liu398220.chatgpt.site), then:

1. Open the target-language menu to see all 16 choices.
2. Select **Use demo profile**.
3. Run **Build my study system** and watch the structured research steps.
4. Compare the three study strategies.
5. Browse every test center, YouTube recommendation, and four-skill resource.
6. Open the connected Notion and Google Calendar examples or download the universal `.ics` calendar.

The seeded learner is an intermediate English speaker in Ho Chi Minh City pursuing IELTS 7.0 for Canadian permanent residence with eight hours available each week.

## What it does

| Capability | Demo result |
|---|---|
| Learner profile | 16 target languages, level, location, goal, deadline, and weekly hours |
| Test explorer | 6 recognized tests, an explained recommendation, and 3 local test centers |
| Guidance | 10 ranked YouTube educators with learner-fit rationale |
| Resource library | 5 listening, speaking, reading, and writing materials per skill |
| Strategy builder | Test-First, Immersion-Led, and Balanced Four-Skill plans |
| Constraint check | Every plan stays inside the learner's declared weekly limit |
| Notion | Connected study database plus an optional server-side page-creation route |
| Calendar | 12 study sessions, 3 recurring reminders, and a universal `.ics` export |

## How it works

Sologurus is designed as a planner over structured operations, not a chatbot that free-writes a curriculum.

```text
Learner profile
      │
      ▼
Planner / orchestrator
      ├── search_tests()      → test choices, sources, and local centers
      ├── rank_guidance()     → ranked educators with rationale
      ├── curate_resources()  → free-first materials grouped by skill
      └── generate_plans()    → 3 strategies + weekly constraint check
                                      │
                                      ▼
                         Notion · Google Calendar · ICS
```

Each stage returns predictable records. The planning layer composes those records into concrete, time-boxed sessions such as “25 min · IELTS Liz Task 2: outline + thesis only” and verifies that the total does not exceed the learner's availability.

### Demo mode and live integrations

- **Deterministic research:** the judge path uses curated fixtures with outbound sources. This makes the demonstration fast, repeatable, and credential-free.
- **Universal calendar:** the dependency-free iCalendar generator produces timezone-aware events that import into Google, Apple, and Outlook Calendar.
- **Connected examples:** the deployed experience links to verified Notion and Google Calendar records created for the demonstration.
- **Live Notion boundary:** when `NOTION_TOKEN` and `NOTION_PARENT_PAGE_ID` are configured on the server, `POST /api/notion` creates a learner-specific page through the Notion API.
- **Planned live mode:** GPT-5.6 is intended to orchestrate source-cited retrieval, ranking, strategy synthesis, and constraint checking behind the same structured boundaries.

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

```bash
git clone https://github.com/Dec444/sologurus-demo.git
cd sologurus-demo
npm install
npm run demo
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required for the core demo or `.ics` download.

### Optional environment variables

Copy `.env.example` to `.env.local` only if you want to exercise integration paths.

| Variable | Purpose |
|---|---|
| `NOTION_TOKEN` | Server-side Notion integration token |
| `NOTION_PARENT_PAGE_ID` | Parent page for learner-specific Notion pages |
| `NOTION_DATABASE_URL` | URL exposed by the connected-demo button |
| `GOOGLE_CALENDAR_EVENT_URL` | URL exposed by the connected-calendar button |

Never commit real tokens. Deployment secrets belong in the hosting environment, not in browser code or tracked files.

## Development

| Command | Purpose |
|---|---|
| `npm run demo` | Start the local judge experience |
| `npm run dev` | Start the development server |
| `npm run build` | Create the production build |
| `npm test` | Build and run the complete regression suite |
| `npm run lint` | Run ESLint |

The tests cover server rendering, language breadth, resource completeness, Notion and Calendar integration boundaries, calendar structure, and minimum readable typography.

### Project map

```text
app/
  api/notion/       Live Notion page-creation boundary
  api/calendar/     Connected-calendar status boundary
  page.tsx          Interactive learner journey
data/               Curated demo resources and language catalog
lib/calendar.mjs    Timezone-aware iCalendar generator
tests/              Node regression tests
public/             Brand and social-preview assets
DEMO_SCRIPT.md       Under-three-minute recording script
DEVPOST_SUBMISSION.md  Hackathon submission narrative
```

## Product decisions

- Structured records instead of one long study-plan prompt
- Strategies that differ by learning philosophy, not “light / medium / heavy” intensity
- Complete resource visibility so learners can inspect the agent's evidence
- ICS first so calendar export works without OAuth
- Broad language choice with one deeply researched judge path
- A readable, responsive interface that keeps dense results scannable

## Built for OpenAI Build Week

Sologurus was built for the **Education** category with Codex and GPT-5.6. Codex accelerated the implementation of the responsive product, structured orchestration states, calendar emitter, integration routes, fixtures, tests, documentation, demo script, and deployment workflow. Human decisions determined the scope, learning strategies, evidence requirements, and reliability tradeoffs.

For the complete story, see the [Devpost submission copy](DEVPOST_SUBMISSION.md). For the intended demonstration sequence, use the [recording script](DEMO_SCRIPT.md).

## Roadmap

- Source-cited live retrieval with freshness checks
- Deep resource catalogs for every supported language
- Placement diagnostics and skill-gap detection
- Adaptive replanning from completed tasks and reflections
- Two-way Notion and Google Calendar synchronization
- Speaking and writing feedback loops
- Secure accounts and OAuth-based integrations

## License

Released under the [MIT License](LICENSE).
