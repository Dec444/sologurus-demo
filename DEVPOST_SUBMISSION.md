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
- Matches nearby opt-in learners by target language, approximate location, and a 5–100 mile radius without exposing exact addresses.
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
5. `generate_plans()` checks feasibility, composes three strategies, and schedules dated sessions through the target date.

The interface is built with Next.js-compatible React and TypeScript, with a responsive dark product design inspired by the clarity and information density of modern tools such as Linear. Comic Neue gives the major headings a friendly educational character, while a clean sans-serif keeps the working interface readable.

We implemented the calendar generator directly against the iCalendar format. It creates timezone-aware events, unique IDs, confirmed statuses, four weeks of study blocks, and daily recurring reminders through the learner's target date.

For integrations, we created a real Notion database with task, date, skill, resource, duration, status, and reflection fields. We also created six real Google Calendar series: three weekly study blocks and three daily behavior reminders. Environment-based server boundaries keep credentials out of the browser.

Codex accelerated the work by translating the project plan and PRD into the interface, orchestration states, data fixtures, calendar emitter, API routes, regression tests, documentation, demo script, and deployment workflow. GPT-5.6 is the intended planner in live mode; the hackathon demo uses the same structured boundaries with deterministic data for speed and reliability.

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

The next version will replace the seeded research layer with source-cited live retrieval and freshness checks. GPT-5.6 will orchestrate the structured tools, personalize rankings, and explain why each resource fits the learner.

We also plan to add:

- Deep resource catalogs and exam guidance for every supported target language.
- Placement diagnostics that identify skill-specific gaps.
- Adaptive weekly replanning based on completed tasks and reflections.
- Secure account-based persistence and deeper calendar synchronization.
- Speaking practice with recording, transcription, and feedback.
- Writing feedback linked to recurring error patterns.
- Progress views that track consistency and skill balance without encouraging unhealthy streak behavior.
- Multi-user accounts, secure OAuth, source monitoring, and integration failure recovery.

Our long-term goal is simple: Sologurus should help any self-directed learner move from “I want to learn” to “I know exactly what to do today.”

## build with

`OpenAI Codex`
`GPT-5.6`
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
