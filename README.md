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

Sologurus turns a learner's language, level, location, goal, deadline, and realistic study rhythm into a transparent study system. It shows the evidence behind its recommendations, estimates whether the deadline is practical, offers three genuinely different strategies, and sends a dated plan to tools learners already use.

> **Hackathon scope:** the public demo ships a dated, source-linked catalog for every selectable language. The browser reloads that catalog through `/api/resources` whenever language or location changes; official exam directories remain the source of truth for current dates and availability.

## Try the demo

Open the [live Sologurus demo](https://sologurus-study-agent.lu-liu398220.chatgpt.site), then:

1. Open the target-language menu to see all 16 choices.
2. Select **Use demo profile**.
3. Run **Build my study system** and watch the dedicated agent-research page populate.
4. Review its five research sections, including three textbook recommendations, then continue to the separate strategy page.
5. Compare the three study strategies and continue to the **Start studying** page.
6. Review the dated study table, mark a few sessions complete, and open **Track progress** to switch among daily, weekly, and monthly statistics.
7. With Notion write credentials configured, create the plan subpage and sync its completed checkboxes; otherwise use Google Calendar or download the universal `.ics` calendar.

The seeded learner is an intermediate English speaker in Ho Chi Minh City pursuing IELTS 7.0 for Canadian permanent residence, studying 1.5 hours per day across six days each week.

## What it does

| Capability | Demo result |
|---|---|
| Learner profile | 16 target languages, dependent country/city menus, level, goal, deadline, daily hours, study days, consistency, and exam experience |
| Feasibility check | Estimates required versus effective hours and clearly flags a tight or impractical deadline |
| Test explorer | Language-specific recognized tests, an explained recommendation, verified local records where available, and an official center finder everywhere |
| Guidance | Exactly 10 language-specific YouTube educators and 3 study forums |
| Immersion | Exactly 10 native-language TV shows with origin, genre, and suggested learner level |
| Mock exams | Exactly 3 language-specific exam simulators or official sample-test platforms |
| Resource library | Listening, speaking, reading, and writing materials that reload with the target language |
| Textbooks | Exactly 3 established, language-specific coursebooks with publisher attribution |
| Strategy builder | Test-First, Immersion-Led, and Balanced Four-Skill plans |
| Dated study plan | 14–84 sessions with dates, phases, focus, textbook, practice source, duration, and completion state |
| Progress | Switchable daily, weekly, and monthly completion charts |
| Notion | Real overview write plus a dated child plan; completed child-page checkboxes sync back into progress |
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
      ├── curate_resources()  → skills + TV immersion + three textbooks
      ├── match_mock_exams()  → three exam-specific practice environments
      └── generate_plans()    → feasibility + 3 strategies + dated sessions
                                      │
                                      ▼
                    Notion subpage · progress chart · Calendar
```

Each stage returns predictable records. The planning layer composes the selected language's exam and resources into concrete, time-boxed sessions and verifies that the total does not exceed the learner's availability.

### Demo mode and live integrations

- **Reactive verified research:** `GET /api/resources` returns a dated catalog for the selected language and location. Exact local addresses are shown only when verified; otherwise Sologurus links to the official center directory and clearly says so.
- **Universal calendar:** the dependency-free iCalendar generator produces timezone-aware events that import into Google, Apple, and Outlook Calendar.
- **Live Notion write and read:** with `NOTION_TOKEN` plus `NOTION_TARGET_PAGE_ID`, `POST /api/notion` replaces one selected overview and creates a dated study-plan subpage. With `NOTION_PARENT_PAGE_ID` instead, it creates the overview beneath that parent and nests the plan below it. `PUT /api/notion` reads completed Sologurus checkboxes from that subpage for the progress chart.
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
data/               Language, community, TV, mock-exam, textbook, forum, and location catalogs
lib/calendar.mjs    Timezone-aware iCalendar generator
lib/learning-plan.mjs  Feasibility, dated-plan, and progress calculations
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
- Secure account-based persistence across devices
- Speaking and writing feedback loops
- Secure accounts and OAuth-based integrations

## License

Released under the [MIT License](LICENSE).
