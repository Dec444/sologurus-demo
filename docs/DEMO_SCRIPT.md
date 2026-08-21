# Sologurus demo script — 2:55 target

**Live product:** [sologurus-study-agent.lu-liu398220.chatgpt.site](https://sologurus-study-agent.lu-liu398220.chatgpt.site)

**Repository:** [github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)

Recording notes: use a 1440p browser, keep the cursor slow, and start at the top of the product. Speak at a relaxed 135–145 words per minute. The bracketed text is direction, not narration.

Before recording:

- Sign in to the Notion and Google accounts used for the connected examples.
- Open the product once so fonts and application assets are cached.
- Reset the product to the profile step.
- Close personal tabs and disable notifications.
- Record one clean take before adding optional Calendar cutaways.

## 0:00–0:18 — The problem

“Self-taught language learners rarely quit because they lack motivation. They quit because research, planning, and daily structure become a second job. Meet Linh: she is in Ho Chi Minh City, needs IELTS 7.0 for Canadian permanent residence, and cannot afford a prep school.”

## 0:18–0:37 — One connection, then community

[Open the **TrueFoundry** chip. Let the three cards land, then close it. Open **Community**, click **Use my location**, allow browser location access, and search for English learners within 10 miles. Then close it, show the country-first menus, and select **Use demo profile**.]

“One chip in the header, and it is the only connection this product has. No model keys, no Notion token, no OAuth client — it reads whatever my own TrueFoundry control plane exposes: the models my account can reach, the MCP tools it was granted, the guardrails and cost tags on every request. Each card links straight back into my console to add more. Then Community uses the learner’s real device location and calculates actual distance within the selected radius, without saving coordinates or exposing addresses. And Sologurus checks the learner’s level, goal, deadline, hours, consistency, and exam experience—and says plainly when the timeline is not practical.”

[Click **Build my study system**.]

## 0:37–1:03 — Agent orchestration

[Let the tool rows animate. Pause when the dedicated research page appears.]

“This is not a chatbot free-writing a curriculum. The model is a planner over structured tools. Four retrieval steps read a verified catalog; the fifth is a real call through the TrueFoundry AI Gateway. Changing the language reloads the whole evidence set—not just the label.”

## 1:03–1:22 — The gateway receipt

[Stop on **What the agent concluded**. Point at the risk flag, then the dark **Gateway receipt** card.]

“Here is what makes this deployable in a school rather than only on a laptop. Every model call in the product goes through one gateway client, and the learner sees the receipt: which model answered, how long it took, how many tokens, the estimated cost, how many fallbacks were used, which guardrails ran, and how much of today's budget is left. The learner id is pseudonymous — no name, no email, no coordinates leave this server. And every citation is checked against the verified catalog: anything the model invented is dropped, not displayed.”

## 1:22–1:52 — Evidence and strategic plans

[Point to the IELTS recommendation. Scroll through the five separately headed research sections: **Tests & centres**; **YouTube, forums & TV shows**; **Reading, speaking, listening & writing**; **Textbook recommendations**; and **Mock exams**. Select **Balanced Four-Skill**, then continue.]

“Linh can inspect every result: verified centre sources, ten ranked YouTube teachers, three forums, ten TV shows, four-skill materials, three established textbooks, and three mock-exam platforms. Titles sit outside the dark result cards, so the dense evidence stays easy to scan.”

## 1:52–2:20 — The payoff

[On **Start studying**, scroll the dated table and mark two sessions complete. Stop on **Governed actions** and point at a blocked tool sitting next to a granted one. Paste a short essay into the writing lab and click **Mark my writing**. In a credentialed demo, click **Update Notion + subpage**, then show the child plan checkboxes. Return, open **Track progress**, switch daily/weekly/monthly, and sync Notion.]

“The selected plan becomes 14 to 84 dated sessions modeled after a real study tracker: phase, focus, textbook, practice, duration, and done state. Notion receives the research overview plus this plan as a child page. Its checked tasks sync back into daily, weekly, and monthly progress. A universal ICS still works with Google, Apple, or Outlook.

Now look at Governed actions. Writing into Notion is an agent action, so it goes through the MCP Gateway — Sologurus holds no Notion token at all, the platform does. Five tools discovered on the server, granted and blocked right there on screen. And there is no NOTION_TOKEN in this codebase at all — a test enforces it. Both directions go through the gateway: tick a box in Notion, come back here, and Sync from Notion reads it straight into the chart. Note what is *not* here: the calendar. It never needed an integration, so we didn't govern one. That is the difference between a demo and something a school can actually switch on. And the writing lab marks a real sample against the exam rubric — with identifiers stripped before the request leaves the server, and prompt logging off for that feature specifically.”

## 2:20–2:47 — How we built it

[Scroll to ‘Why this is an agent, not a prompt.’ Keep the schema card visible.]

“The end-to-end build came together fast: orchestration states, responsive interface, ICS emitter, fixtures, tests, documentation, and deployment workflow. TrueFoundry governs the runtime: the AI Gateway gives one OpenAI-compatible endpoint with an ordered model fallback chain, guardrails, per-learner budgets, and cost attribution by tenant and cost centre — and the MCP Gateway brokers the Notion write, so no integration credential lives in this application. Pull the credentials and the product still runs — the deterministic planner answers and every AI panel says so.

The human decisions were equally important: structured tools over free text, strategies over intensity tiers, ICS before OAuth, and an explicit official-directory fallback instead of invented local test centres. Those choices make Sologurus reliable enough to use, and simple enough for any self-directed learner to start.”

## 2:47–2:55 — Close

[Return to the Sologurus wordmark or hero.]

“Sologurus: one goal, a plan you can actually follow.”

## Backup lines if the recording runs short

- “Free-first curation keeps the plan accessible, not just academically sound.”
- “The resource endpoint reloads immediately when language or location changes, while official directories supply changing dates and availability.”

## Submission copy

**Title:** Sologurus — the self-directed language learning agent

**Description:** Sologurus turns a language-test goal into verified resources, an honest deadline-feasibility check, and a dated study plan. Learners can choose from 16 languages, inspect five evidence groups, send a child plan to Notion, and track daily, weekly, or monthly completion. It runs on TrueFoundry: the AI Gateway governs model access with guardrails, per-learner budgets and a cost receipt the learner can read, and the MCP Gateway brokers the Notion write against a closed-by-default skills registry.

**Live demo:** [https://sologurus-study-agent.lu-liu398220.chatgpt.site](https://sologurus-study-agent.lu-liu398220.chatgpt.site)

**Source:** [https://github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)
