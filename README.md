# Sologurus

**A self-directed language-learning agent that turns a goal into evidence, strategy, and scheduled action.**

[Live demo](https://sologurus.com) | [Demo script](docs/DEMO_SCRIPT.md) | [Submission](SUBMISSION.md) | [Source](https://github.com/Dec444/sologurus-demo)

[![CI](https://github.com/Dec444/sologurus-demo/actions/workflows/ci.yml/badge.svg)](https://github.com/Dec444/sologurus-demo/actions/workflows/ci.yml)

## What it does

Sologurus turns a learner's language goal, level, location, deadline, and weekly availability into an actionable study system.

- Supports 16 target languages.
- Compares recognized tests and links to official test-centre information.
- Curates educators, communities, immersion media, textbooks, and exam-practice resources.
- Builds Test-First, Immersion-Led, and Balanced Four-Skill strategies.
- Checks whether a deadline is practical.
- Produces dated sessions with resources, duration, and completion tracking.
- Shows daily, weekly, and monthly progress.
- Exports a standard ICS calendar for Google, Apple, or Outlook without OAuth.
- Finds nearby learners from browser-approved location without retaining or exposing exact coordinates.
- Runs grounded research synthesis and writing feedback through TrueFoundry.

The public demo uses a dated, source-linked catalog. Official directories remain the authority for changing exam dates and test-centre details.

## Try it

Open [sologurus.com](https://sologurus.com), then:

1. Open the **TrueFoundry** chip to inspect the connected model and policy state.
2. Try **Community** with browser-approved location, or select **Use demo profile**.
3. Build a study system and inspect the research sections.
4. Compare the three strategies and select one.
5. Mark sessions complete, switch progress views, and download the calendar file.

The seeded learner is an intermediate English speaker in Ho Chi Minh City pursuing IELTS 7.0 for Canadian permanent residence.

## Architecture

Sologurus is a planner over structured operations, not a chatbot that writes one long curriculum.

    Learner profile
          |
          v
    Planner / orchestrator
          |- search_tests()      -> recognized tests, sources, centres
          |- rank_guidance()     -> educators and communities
          |- curate_resources()  -> four-skill resources and immersion
          |- match_mock_exams()  -> exam-practice environments
          '- synthesize_plan()   -> feasibility, strategy, dated sessions
                                          |
                                          v
                             TrueFoundry AI Gateway
                        model | policy | budget | receipt
                                          |
                                          v
                             Study plan | progress | ICS

The app is React and TypeScript, built with Vinext/Vite and deployed as a Cloudflare Worker.

## TrueFoundry AI Gateway

All model calls go through one server-side gateway client: [lib/truefoundry/gateway.mjs](lib/truefoundry/gateway.mjs).

The current deployment uses:

    google-gemini/gemma-4-26b-a4b-it

The gateway boundary provides:

- **Privacy:** learner ids are pseudonymous; learner prose is redacted server-side before it reaches the model.
- **Policy and cost context:** each request carries tenant, cost-centre, environment, feature, and learner metadata for TrueFoundry budgets, rate limits, and guardrails.
- **Grounding:** citations are checked against the verified catalog before display.
- **Readable receipts:** model, latency, tokens, estimated cost, fallbacks, and policy context can be surfaced in the product.
- **Honest degradation:** without a valid gateway, the deterministic planner continues and AI features state that they are offline.

Non-secret gateway status: GET /api/gateway

## MCP and Notion

Sologurus never stores a Notion credential and has no direct Notion API route. Its only potential Notion path is a TrueFoundry MCP Gateway server.

    Sologurus -- POST /api/mcp --> TrueFoundry MCP Gateway --> Notion MCP server
                                  allowed tools + visitor authorization

The server accepts only three declared actions:

| Product intent | Allowed MCP tool |
|---|---|
| Create a study-plan page | notion-create-pages |
| Read plan progress | notion-fetch |
| Find a plan location | notion-search |

The browser names an intent, never an arbitrary MCP tool. The server constructs the payload and refuses tools outside the allowlist.

A public visitor must complete their own TrueFoundry/Notion authorization before an action can run. If that authorization, an MCP server, or an allowed tool is unavailable, Sologurus fails closed and does not touch a workspace. This is intentional. The ICS calendar export remains separate because it needs no account or integration.

Non-secret MCP status: GET /api/mcp

## Run locally

### Requirements

- Node.js 22.13 or newer
- npm

    git clone https://github.com/Dec444/sologurus-demo.git
    cd sologurus-demo
    npm install
    npm run demo

Open [http://localhost:3000](http://localhost:3000). The deterministic planner and calendar export require no environment variables.

### Optional environment variables

Copy .env.example to .env.local for TrueFoundry integration.

| Variable | Purpose |
|---|---|
| TFY_API_KEY | TrueFoundry virtual-account token. Keep this secret. |
| TFY_GATEWAY_BASE_URL | AI Gateway base URL; use https://gateway.truefoundry.ai for SaaS. |
| TFY_MODEL_CHAIN | Ordered model fallback chain, for example google-gemini/gemma-4-26b-a4b-it. |
| TFY_INPUT_GUARDRAILS / TFY_OUTPUT_GUARDRAILS | Guardrail groups applied to requests. |
| TFY_TENANT / TFY_COST_CENTER / TFY_ENVIRONMENT | Cost-attribution metadata. |
| TFY_REQUEST_TIMEOUT_MS / TFY_TTFT_TIMEOUT_MS | Gateway time limits. |
| TFY_MCP_BASE_URL | MCP proxy base if it differs from the inference base. |
| TFY_MCP_SERVERS | MCP servers as label:integrationId pairs. |
| TFY_MCP_ALLOWED_TOOLS | Closed allowlist of server/tool pairs. |
| TFY_MCP_NOTION_PARENT | Optional parent page id for new Notion pages. |
| TFY_CONSOLE_URL | TrueFoundry console origin for operator links. |
| TFY_CONSOLE_MODELS_PATH / TFY_CONSOLE_MCP_PATH | Optional console paths. |

Do not add NOTION_TOKEN to the application. Do not commit real tokens.

## Deploy to Cloudflare

The Worker is named sologurus and configured in [wrangler.jsonc](wrangler.jsonc).

Cloudflare Workers Builds deploys GitHub main. Runtime configuration belongs in **Cloudflare -> Workers & Pages -> sologurus -> Settings -> Variables and Secrets**:

- Store TFY_API_KEY as a **Secret**.
- Store the remaining TFY_* settings as **Variables**.
- Use the **Production** environment.

The configuration has keep_vars set to true. This prevents later Git/Wrangler deployments from deleting Cloudflare-managed variables. It does not put secrets or runtime values into Git.

After a fresh deployment, verify the active configuration at /api/gateway and /api/mcp.

## Development

| Command | Purpose |
|---|---|
| npm run demo | Start the local judge experience |
| npm run dev | Start the development server |
| npm run build | Create the production build |
| npm test | Build and run the regression suite |
| npm run lint | Run ESLint |

## Project map

    app/
      api/agent/          Grounded research synthesis
      api/feedback/       Writing feedback
      api/gateway/        Gateway status and model information
      api/mcp/            MCP discovery and declared-action dispatch
      api/resources/      Per-language, per-location catalog
      api/community/      Location and radius matching
      api/calendar/       Calendar status boundary
      page.tsx            Interactive learner journey

    lib/truefoundry/
      gateway.mjs         AI Gateway client and receipts
      governance.mjs      Budgets, redaction, grounding, policy
      mcp-gateway.mjs     MCP handshake, allowlist, tool calls
      mcp-actions.mjs     Declared product intents

    lib/study/
      catalog.ts          Catalog builder and model-facing digest
      learning-plan.mjs   Feasibility, plans, and progress
      calendar.mjs        Timezone-aware iCalendar generation

    data/                 Language and resource catalogs
    tests/                Node regression tests
    docs/                 Recording script and screenshots

## Product decisions

- Structured records instead of a single free-text plan.
- Strategy choice, not just intensity choice.
- Source-linked evidence learners can inspect.
- Calendar export without OAuth.
- One TrueFoundry gateway chokepoint for model governance.
- Closed-by-default MCP actions rather than application-held credentials.
- Visible AI receipts instead of an invisible black box.
- Cloudflare runtime variables kept outside Git and preserved across deployments.

## Roadmap

- Per-visitor OAuth for Notion actions through the TrueFoundry MCP Gateway.
- Secure cross-device persistence and adaptive replanning.
- Placement diagnostics and skill-gap practice.
- Source freshness checks and expanded catalogs.
- Speaking practice, transcription, and feedback.
- Per-institution budgets, guardrails, and skills registries.

## License

Released under the [MIT License](LICENSE).
