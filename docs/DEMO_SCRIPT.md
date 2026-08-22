# Sologurus demo script — 2:45 target

**Live product:** [sologurus.com](https://sologurus.com)
**Repository:** [github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)

Recording notes: use a 1440p browser, keep the cursor slow, and start at the top of the product. Speak at a relaxed 135–145 words per minute. Bracketed text is direction, not narration.

Before recording:

- Open the production deployment once so fonts and assets are cached.
- Confirm the TrueFoundry model card shows `google-gemini/gemma-4-26b-a4b-it`.
- Reset the product to the profile step.
- Close personal tabs and disable notifications.
- Do not demonstrate a Notion write unless the current viewer has completed their own TrueFoundry/Notion authorization. The public demo correctly fails closed otherwise.

## 0:00–0:18 — The problem

“Self-taught language learners rarely quit because they lack motivation. They quit because research, planning, and daily structure become a second job. Meet Linh: she is in Ho Chi Minh City, needs IELTS 7.0 for Canadian permanent residence, and cannot afford a prep school.”

## 0:18–0:37 — Connection and community

[Open the **TrueFoundry** chip. Pause on the AI Gateway and Policy cards. If the MCP card reports no tools, say that is a deliberate fail-closed state. Close it. Open **Community**, click **Use my location**, allow browser location access, and search for English learners within 10 miles. Then select **Use demo profile**.]

“One chip shows the platform I control. The AI Gateway shows the connected Gemma model; Policy shows the guardrails, cost tags, and learner ceilings carried with every request. Personal integrations are deliberately stricter: a visitor’s Notion account is never silently shared with the app. Community uses browser-approved location to calculate nearby learners without saving exact coordinates or exposing addresses. Then Sologurus checks the learner’s level, goal, deadline, hours, consistency, and exam experience—and says plainly when the timeline is not practical.”

[Click **Build my study system**.]

## 0:37–1:02 — Agent orchestration

[Let the tool rows animate. Pause when the research page appears.]

“This is not a chatbot free-writing a curriculum. The model is a planner over structured operations. Four retrieval steps read a verified catalog; the synthesis step runs through the TrueFoundry AI Gateway. Changing the language reloads the whole evidence set—not just the label.”

## 1:02–1:21 — Governed model receipt

[Stop on **What the agent concluded**. Point at the risk flag and the gateway receipt.]

“Every model call goes through one server-side gateway client. The receipt makes the AI legible: model, latency, tokens, estimated cost, fallbacks, guardrails, and budget context. The learner id is pseudonymous—no name, email, or coordinates leave this server. And every citation is checked against the verified catalog, so invented sources are dropped rather than displayed.”

## 1:21–1:50 — Evidence and strategies

[Point to the IELTS recommendation. Scroll through the research sections: **Tests & centres**, **YouTube, forums & TV shows**, **Reading, speaking, listening & writing**, **Textbook recommendations**, and **Mock exams**. Select **Balanced Four-Skill**.]

“Linh can inspect the evidence behind the plan: official test-centre sources, ranked teachers, forums, immersion media, four-skill materials, textbooks, and mock-exam platforms. She chooses among three strategies with genuinely different learning philosophies: exam practice, immersion, or balanced skills.”

## 1:50–2:17 — The payoff

[Open **Start studying**. Scroll the dated table and mark two sessions complete. Open **Track progress** and switch daily, weekly, and monthly. Export the calendar.]

“The selected strategy becomes a dated, workbook-like study plan: phase, focus, resource, duration, and completion state. Two checked sessions become visible in daily, weekly, and monthly progress. Then one export creates a standard calendar file that imports into Google, Apple, or Outlook—no calendar OAuth required.”

[Open the TrueFoundry chip again and pause on the MCP card.]

“Notion is intentionally different. Sologurus never holds a Notion token. Any future Notion action goes through a TrueFoundry MCP server with a closed tool allowlist and the visitor’s own authorization. If authorization is absent, the app reports no available action instead of touching a workspace it should not reach. That is the security boundary, not a missing demo feature.”

## 2:17–2:38 — How it ships

[Show the GitHub repository, then return to the app.]

“The product is React and TypeScript, deployed from GitHub to a Cloudflare Worker. TrueFoundry governs the runtime model; Cloudflare keeps runtime values and secrets outside the repository. The Worker is configured to preserve those dashboard variables on later Git deployments, so a code update cannot silently remove the model, guardrails, or MCP configuration.”

## 2:38–2:45 — Close

[Return to the Sologurus wordmark or hero.]

“Sologurus: one goal, a plan you can actually follow.”

## Backup lines if the recording runs short

- “Free-first curation keeps the plan accessible, not just academically sound.”
- “The deterministic planner remains useful when the model gateway is unavailable.”
- “Failing closed is the right behavior when a learner’s personal workspace has not been authorized.”

## Submission copy

**Title:** Sologurus — the self-directed language learning agent

**Description:** Sologurus turns a language-test goal into verified resources, an honest deadline-feasibility check, and a dated study plan. Learners can choose from 16 languages, inspect source-linked evidence, export a calendar, and track daily, weekly, or monthly completion. It runs through TrueFoundry: the AI Gateway provides governed model access with guardrails, per-learner budgets, and readable receipts; the MCP Gateway is closed by default and never stores a Notion credential.

**Live demo:** [https://sologurus.com](https://sologurus.com)

**Source:** [https://github.com/Dec444/sologurus-demo](https://github.com/Dec444/sologurus-demo)
