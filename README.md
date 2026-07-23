<div align="center">

![Sologurus — better direction, smarter study](public/og-editorial.png)

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

> **Hackathon scope:** the public demo ships a dated, source-linked catalog for every selectable language. The browser reloads that catalog through `/api/resources` whenever language or location changes; official exam directories remain the source of truth for current dates and availability.

## Try the demo

Open the [live Sologurus demo](https://sologurus-study-agent.lu-liu398220.chatgpt.site), then:

1. Open the target-language menu to see all 16 choices.
2. Select **Use demo profile**.
3. Run **Build my study system** and watch the structured research steps.
4. Compare the three study strategies.
5. Scroll through four complete research sections: tests and centers; YouTube, forums, and TV shows; four-skill materials; and mock-exam platforms.
6. With Notion write credentials configured, update the selected Notion page; otherwise use Google Calendar or download the universal `.ics` calendar.

The seeded learner is an intermediate English speaker in Ho Chi Minh City pursuing IELTS 7.0 for Canadian permanent residence with eight hours available each week.

## What it does

| Capability | Demo result |
|---|---|
| Learner profile | 16 target languages, dependent country/city menus, level, goal, deadline, and weekly hours |
| Test explorer | Language-specific recognized tests, an explained recommendation, verified local records where available, and an official center finder everywhere |
| Guidance | Exactly 10 language-specific YouTube educators and 3 study forums |
| Immersion | Exactly 10 native-language TV shows with origin, genre, and suggested learner level |
| Mock exams | Exactly 3 language-specific exam simulators or official sample-test platforms |
| Resource library | Listening, speaking, reading, and writing materials that reload with the target language |
| Strategy builder | Test-First, Immersion-Led, and Balanced Four-Skill plans |
| Constraint check | Every plan stays inside the learner's declared weekly limit |
| Notion | Real server-side page replacement or child-page creation using the current profile, strategy, and full research set |
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
      ├── curate_resources()  → free-first materials + target-language TV immersion
      ├── match_mock_exams()  → three exam-specific practice environments
      └── generate_plans()    → 3 strategies + weekly constraint check
                                      │
                                      ▼
                         Notion · Google Calendar · ICS
```

Each stage returns predictable records. The planning layer composes the selected language's exam and resources into concrete, time-boxed sessions and verifies that the total does not exceed the learner's availability.

### Demo mode and live integrations

- **Reactive verified research:** `GET /api/resources` returns a dated catalog for the selected language and location. Exact local addresses are shown only when verified; otherwise Sologurus links to the official center directory and clearly says so.
- **Universal calendar:** the dependency-free iCalendar generator produces timezone-aware events that import into Google, Apple, and Outlook Calendar.
- **Live Notion write:** with `NOTION_TOKEN` plus `NOTION_TARGET_PAGE_ID`, `POST /api/notion` replaces one selected page with the current plan. With `NOTION_PARENT_PAGE_ID` instead, it creates a new learner-specific child page. It never reports a static link as a successful update.
- **Honest source model:** exam dates and venue availability can change, so the product never invents a nearby address; it routes learners to the owning exam body's current directory.

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
| `NOTION_TARGET_PAGE_ID` | Existing page to replace with the current selected plan |
| `NOTION_PARENT_PAGE_ID` | Parent page for learner-specific Notion pages |
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
  api/notion/       Live Notion page-update/create boundary
  api/calendar/     Connected-calendar status boundary
  page.tsx          Interactive learner journey
data/               Language, community, TV, mock-exam, forum, and location catalogs
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
