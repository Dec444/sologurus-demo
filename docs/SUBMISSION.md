# Sologurus

**Live demo:** [sologurus-study-agent.lu-liu398220.chatgpt.site](https://sologurus-study-agent.lu-liu398220.chatgpt.site)  
**Source code:** [github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)  
**Demo script:** [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

## Inspiration

Self-directed language learners rarely fail because they lack motivation. They struggle because turning a goal into a reliable daily system requires hours of scattered research: choosing the right exam, locating a test center, evaluating teachers, finding materials for every skill, and fitting everything into a realistic schedule.

We imagined a learner like Linh, an intermediate English speaker in Ho Chi Minh City who wants an IELTS 7.0 for Canadian permanent residence. She has eight hours each week, a fixed deadline, and no budget for a prep school. Sologurus was inspired by one question: what if an educational agent could do the planning work of a tutor while leaving the learning decisions—and the learning itself—in the student's hands?

## What it does

Sologurus turns a learner's goal, level, location, deadline, and weekly availability into an actionable study system.

The agent:

- Keeps GitHub plus Notion and Google account/connection actions visible in the homepage utility bar.
- Uses browser-approved live coordinates to calculate nearby learner matches within a 5–100 mile radius, without saving coordinates to a learner profile or exposing exact addresses.
- Supports 16 target-language choices.
- Compares recognized tests for the selected language and recommends the best match for the learner's goal.
- Shows real test-center locations and official booking links.
- Ranks ten YouTube educators with learner-fit explanations.
- Recommends three language-specific study forums.
- Curates ten native-language TV shows for guided immersion.
- Provides three exam-specific mock platforms or official sample-test environments.
- Recommends three established, language-specific textbooks.
- Exposes listening, speaking, reading, and writing materials instead of hiding them inside a generated plan.
- Produces three genuinely different strategies: Test-First, Immersion-Led, and Balanced Four-Skill.
- Asks about daily hours, study days, consistency, and exam experience, then flags tight or impractical deadlines.
- Generates a dated, phased study plan with a textbook, practice resource, duration, and checkbox for every session.
- Tracks completion with switchable daily, weekly, and monthly charts.
- Creates a four-week calendar containing 12 study sessions and three recurring daily habit reminders.
- Writes the research overview to Notion, creates the dated plan as its subpage, and reads completed checkboxes back into progress.
- Exports a standards-based `.ics` file for Google, Apple, or Outlook Calendar without requiring OAuth.

The public demo uses dated, source-linked catalogs for all 16 languages. Its server-side Notion route can replace or create an overview, nest a study plan beneath it, and sync completed plan checkboxes when deployment credentials are configured.

## How we built it

We designed Sologurus as a planner over structured tools rather than a chatbot that writes one long study-plan response. The product flow models five explicit operations:

1. `search_tests()` returns test options, official sources, and nearby centers.
2. `rank_guidance()` scores educators and communities for the learner's level and goal.
3. `curate_resources()` organizes free-first materials and a ten-show immersion watchlist.
4. `match_mock_exams()` selects three exam-specific practice environments.
5. `synthesize_plan()` checks feasibility, composes three strategies, and schedules dated sessions through the target date.

The interface is built with Next.js-compatible React and TypeScript, with a responsive dark product design inspired by the clarity and information density of modern tools such as Linear. Comic Neue gives the major headings a friendly educational character, while a clean sans-serif keeps the working interface readable.

We implemented the calendar generator directly against the iCalendar format. It creates timezone-aware events, unique IDs, confirmed statuses, four weeks of study blocks, and daily recurring reminders through the learner's target date.

For integrations, we created a real Notion database with task, date, skill, resource, duration, status, and reflection fields. We also created six real Google Calendar series: three weekly study blocks and three daily behavior reminders. Environment-based server boundaries keep credentials out of the browser.

We translated the project plan and PRD into the interface, orchestration states, data fixtures, calendar emitter, API routes, regression tests, documentation, demo script, and deployment workflow.

### Bring your own platform

The clearest way to describe Sologurus is that it is a planning agent with no vendor relationships of its own. It has no API keys for model providers, no Notion token, no OAuth client. It has exactly one connection: your TrueFoundry account.

The header carries a single chip. Open it and you see what *your* control plane exposes — every model the account can reach (discovered live from the gateway's `/models` route), every registered MCP server with its tools marked granted or blocked, and the guardrails and cost tags every request carries. Each card links straight into your console. Connect a model, it appears. Register a server, its tools appear.

That is why there is no Notion login and no Google login in the interface. Those relationships belong in the platform an institution already administers, not in an application's environment.

### Governing the AI layer with TrueFoundry

The fifth operation is the one that actually needs a model, and in an education product that is exactly where the hard questions live: whose data is in the prompt, which model answered, what did it cost, and can the institution running it prove any of that afterwards.

So every model call in Sologurus goes through a single client, `lib/truefoundry/gateway.mjs`, pointed at the TrueFoundry AI Gateway. Nothing else in the codebase can reach an LLM, and a regression test enforces it.

That one chokepoint buys the whole governance story:

- **Reliability under load.** `TFY_MODEL_CHAIN` is an ordered fallback list. A 429, a 5xx, or a timeout moves to the next model; a 401 stops immediately, because a credential fault is a configuration bug, not something to retry against three providers. Exam-season spikes degrade instead of failing.
- **Privacy by construction.** Requests carry a pseudonymous learner id derived from study goals — never a name, an email, or coordinates. Learner prose is redacted server-side *before* it reaches the gateway, independently of the gateway's own PII guardrail, so a misconfigured guardrail cannot become a data-exposure bug. `x-tfy-logging-config` turns prompt logging off for any feature carrying learner writing.
- **Cost attribution.** `x-tfy-metadata` tags every call with tenant, cost centre, environment, feature, and learner id — the same keys a gateway rate-limit or budget rule matches on. The application declares its own per-learner ceilings in `lib/truefoundry/governance.mjs` and mirrors the spend locally so the learner can see it.
- **Grounding.** The model receives a digest of catalog names, levels, and purposes — never URLs or addresses. Any citation it returns that is not in the verified catalog is dropped rather than displayed, which is what lets Sologurus keep its promise never to invent a test centre.
- **Observability the learner can read.** The research page shows a gateway receipt: model, latency, tokens, estimated cost, fallbacks used, guardrails applied, and remaining daily budget. The AI is not a black box in the corner of the product.

The gateway also unlocked the feature that had been sitting in our roadmap: a **writing feedback loop** that marks a learner sample against the target exam rubric, quoting the learner's own words. It ships behind the strictest policy in the app — redaction, no prompt logging, a tighter daily ceiling.

### Brokering the writes with the MCP Gateway

The other half of the problem is not inference at all. Sologurus writes a study plan into Notion — and in a school, *that* is the part with real blast radius. Holding a Notion token in the application's environment means a leak of our deployment is a leak of someone's workspace.

So those writes go through the TrueFoundry MCP Gateway instead. `lib/truefoundry/mcp-gateway.mjs` is a dependency-free MCP client over the gateway's streamable-HTTP proxy at `{gateway}/mcp/{integrationId}/server` — initialize, echo the session id, list tools, call tools. Three things fall out of that:

- **We hold no Notion credential — we deleted it.** The direct Notion API route is gone. Both the write and the progress read go through the gateway, and a regression test walks the whole source tree asserting that nothing calls `api.notion.com` and nothing reads a Notion secret. The claim is enforced, not asserted.
- **The skills allowlist is closed by default.** A tool the registry exposes but this product was never granted is refused before the request is even built, and again in the route. The Governed Actions panel lists all five discovered Notion tools with two marked GRANTED and three BLOCKED, so an administrator reads the app's actual reach off the screen instead of trusting a claim.
- **The browser names an intent, never a tool.** Declared actions bind one product intent to one tool, and the payload is built server-side. There is no endpoint that will call an arbitrary tool with an arbitrary body.
- **Actions are metered like inference.** Dispatches count against a per-learner daily ceiling, refused ones included.

One decision we're happy with: we did *not* broker the calendar. TrueFoundry's registry offers Notion, and calendar export never needed an integration anyway — the `.ics` is generated in the browser and imports into Google, Apple, or Outlook with no account. Governing something that has nothing to govern would have been theatre.

The round trip is the part we like most. Each session in the Notion page carries a `[Sologurus day N]` marker, so a learner can tick boxes in Notion, reorder them, or rewrite the text around them, and `notion-fetch` still resolves the right sessions back into the progress chart. Two brokered calls, no token, full loop.

And there is no fallback. With no MCP server registered, Sologurus cannot touch Notion in either direction, because it has nothing to touch it with — the interface says exactly that. We think that is the correct failure mode for a school product: the application's reach is defined by the registry, not by what happens to be in its environment.

With no gateway credentials at all, the app still runs end to end. The deterministic planner answers, every AI panel is labelled offline, and the writing lab reports a structural check that explicitly refuses to invent a band score. Honest degradation was a product requirement, not a fallback we bolted on.

## Challenges we ran into

The first challenge was scope. Language learning is enormous, but a hackathon demo must be understandable in minutes. We solved this with a shared evidence schema and dated, source-linked catalogs for all 16 selectable languages.

The second challenge was transparency. Early versions generated a useful plan but did not expose all the evidence behind it. A learner needs to see the test centers, recommended educators, and every listening, speaking, reading, and writing resource. We redesigned the results as a browsable research library with official outbound links.

The third challenge was making integrations real without making the demo fragile. OAuth flows can consume a large part of a hackathon and often fail in judge environments. We used a layered approach: verified Notion and Google Calendar connections for the live demonstration, a credential-aware Notion API route for production writes, and a universal `.ics` export that works without keys.

The final challenge was balancing information density with readability. The resource library contains a lot of material, and our first dark-interface pass made secondary text too small. We introduced a 16px body baseline, larger card copy, more generous line height, and a regression test that prevents important text from shrinking below readable sizes.

## Accomplishments that we're proud of

We are proud that Sologurus is more than a polished plan generator. Learners can inspect the evidence, understand why a strategy was recommended, choose a different strategy, and send the result into tools they already use.

We are especially proud of:

- Turning a broad educational problem into a focused end-to-end learner journey.
- Making every resource category visible and directly accessible.
- Producing three strategies that differ by learning philosophy rather than simple intensity levels.
- Giving an honest feasibility verdict before asking a learner to commit.
- Turning the chosen strategy into a workbook-like dated plan and switchable progress statistics.
- Building a dependency-free, timezone-aware calendar exporter.
- Connecting real Notion and Google Calendar records.
- Delivering a zero-key judge path without pretending that seeded data is live search.
- Adding automated coverage for language breadth, resource completeness, integration readiness, calendar structure, server rendering, and typography readability.

## What we learned

We learned that educational agents need to show their work. A recommendation becomes much more trustworthy when the learner can inspect its source, compare alternatives, and understand how it fits their constraints.

We also learned that strategy matters more than volume. Three plans are useful only when they represent meaningful choices. “Study more” is not a strategy; choosing between exam practice, immersion, and balanced skill development is.

Most importantly, integrations should support the learning habit rather than become the product. Notion is valuable because it makes tasks and reflections visible. Calendar is valuable because it reserves time and creates reminders. The agent remains responsible for converting a vague ambition into specific, achievable actions.

Finally, deterministic demos and live systems are not opposites. A strong hackathon product can use reliable fixtures for its evaluation path while maintaining honest, production-ready integration boundaries for the next stage.

## What's next for Sologurus

The next version will replace the seeded research layer with source-cited live retrieval and freshness checks. The planning model — whichever the operator connects through TrueFoundry — will orchestrate the structured tools, personalize rankings, and explain why each resource fits the learner.

We also plan to add:

- Deep resource catalogs and exam guidance for every supported target language.
- Placement diagnostics that identify skill-specific gaps.
- Adaptive weekly replanning based on completed tasks and reflections.
- Secure account-based persistence and deeper calendar synchronization.
- Speaking practice with recording, transcription, and feedback.
- Speaking feedback, alongside the writing loop that now ships.
- Per-institution tenancy on the gateway, so a school sees its own budgets, guardrail policy, skills registry, and usage dashboards.
- Progress views that track consistency and skill balance without encouraging unhealthy streak behavior.
- Multi-user accounts, secure OAuth, source monitoring, and integration failure recovery.

Our long-term goal is simple: Sologurus should help any self-directed learner move from “I want to learn” to “I know exactly what to do today.”

## build with

`TrueFoundry AI Gateway`
`TrueFoundry MCP Gateway`
`Model Context Protocol`
`Next.js`
`React`
`TypeScript`
`Node.js`
`Vite`
`Vinext`
`Tailwind CSS`
`Cloudflare Workers`
`Notion API`
`Google Calendar`
`iCalendar`
`GitHub Actions`
`ESLint`
`HTML5`
`CSS3`
