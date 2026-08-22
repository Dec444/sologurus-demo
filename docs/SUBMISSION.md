# Sologurus

**Live demo:** [sologurus.com](https://sologurus.com)
**Source code:** [github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)
**Demo script:** [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

## Inspiration

Self-directed language learners rarely fail because they lack motivation. They struggle because choosing an exam, finding reliable resources, and fitting practice into a real week becomes a second job. Sologurus asks a practical question: what if an educational agent could turn a goal into a trustworthy daily system while keeping the learner in control?

## What it does

Sologurus turns a learner’s goal, level, location, deadline, and weekly availability into an actionable study system.

- Supports 16 target languages.
- Compares recognized tests, official sources, and nearby test-centre information.
- Curates educators, communities, immersion media, textbooks, and exam-practice resources.
- Produces three distinct strategies: Test-First, Immersion-Led, and Balanced Four-Skill.
- Checks whether a deadline is practical before asking a learner to commit.
- Creates a dated plan with sessions, resources, duration, and completion tracking.
- Shows daily, weekly, and monthly progress.
- Exports a standards-based `.ics` calendar for Google, Apple, or Outlook without an account connection.
- Offers privacy-preserving local community discovery from browser-approved location; precise coordinates are neither retained nor shown to other learners.
- Runs model-backed research synthesis and writing feedback through the operator’s TrueFoundry AI Gateway.

## How we built it

Sologurus is a planner over structured tools, not a chatbot that writes one long curriculum. It models five explicit operations:

1. `search_tests()` returns test options, official sources, and nearby centres.
2. `rank_guidance()` scores educators and communities for the learner’s level and goal.
3. `curate_resources()` organizes free-first materials and an immersion watchlist.
4. `match_mock_exams()` selects exam-specific practice environments.
5. `synthesize_plan()` checks feasibility, composes three strategies, and schedules dated sessions.

The interface is React and TypeScript, built with Vinext/Vite and deployed as a Cloudflare Worker. GitHub is the source of truth: Cloudflare Workers Builds deploys the `main` branch. The Worker configuration uses `keep_vars: true`, so subsequent Git deployments preserve the dashboard-managed TrueFoundry, guardrail, and MCP variables. The TrueFoundry virtual-account token remains a Cloudflare secret and is never stored in Git.

The calendar generator writes iCalendar directly: timezone-aware events, stable IDs, confirmed statuses, study blocks, and recurring reminders.

## Governing the AI layer with TrueFoundry

All model calls go through one server-side TrueFoundry AI Gateway client. The current deployment uses `google-gemini/gemma-4-26b-a4b-it`.

That boundary provides:

- **Privacy:** requests use a pseudonymous learner id, not a learner name, email, or coordinates. Learner prose is redacted server-side before it reaches the gateway.
- **Cost and policy:** every request carries tenant, cost-centre, environment, feature, and learner metadata so TrueFoundry budgets, rate limits, and guardrails can apply.
- **Reliable degradation:** without a valid gateway, the deterministic planner still works and AI panels describe their offline state rather than inventing an answer.
- **Grounding:** model citations are checked against the verified catalog before display.
- **Readable observability:** the product can surface the model, latency, tokens, estimated cost, fallbacks, guardrails, and budget context.

## MCP and Notion: secure by default

Sologurus has no Notion token and no direct Notion API route. Its only possible Notion path is the TrueFoundry MCP Gateway, where the product allows only three named actions:

- `notion-create-pages`
- `notion-fetch`
- `notion-search`

The browser names a product intent, not an arbitrary MCP tool, and the server builds the payload. If an MCP server, allowed skill, or valid authorization is missing, the action fails closed: Sologurus cannot access a workspace.

The public deployment currently requires each visitor to complete their own TrueFoundry/Notion authorization before a Notion action can run. It intentionally does not use a shared Notion credential. Calendar export remains independent because a downloaded `.ics` file needs no integration at all.

## Challenges and lessons

The hardest trade-off was making a convincing public demo without pretending that sensitive integrations are universal. The application makes its connected-model and policy state visible, but it does not claim a visitor’s Notion workspace is connected when it is not.

We also learned that deployment configuration is product configuration. A Git-based Worker deploy originally removed dashboard variables that were not declared in the repository. Adding `keep_vars: true` gives the Git workflow a durable boundary: code ships from GitHub; runtime values and secrets remain managed in Cloudflare.

## Accomplishments

- A complete learner journey from goal to dated plan and calendar export.
- Source-linked, language-specific evidence for 16 languages.
- Three strategy-distinct study plans with an honest feasibility check.
- A governed TrueFoundry model path with privacy, cost, and policy context.
- A closed-by-default MCP design that never stores a Notion credential.
- Cloudflare Worker deployment from GitHub, with protected runtime variables.
- Automated coverage for planning, resources, integrations, deployment configuration, and readable UI.

## What’s next

- Per-visitor OAuth completion for TrueFoundry-hosted Notion MCP actions.
- Secure persistence and adaptive weekly replanning.
- Placement diagnostics and skill-specific practice.
- Source freshness checks and broader evidence catalogs.
- Speaking practice, transcription, and feedback.
- Institution-specific tenancy, budgets, guardrails, and skills registries.

## Built with

`TrueFoundry AI Gateway`
`TrueFoundry MCP Gateway`
`Model Context Protocol`
`React`
`TypeScript`
`Node.js`
`Vite`
`Vinext`
`Cloudflare Workers`
`GitHub`
`iCalendar`
