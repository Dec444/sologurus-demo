# Sologurus — Hackathon PRD & Build Spec

**Event:** OpenAI Build Week (Codex + GPT-5.6)
**Scope:** Ship-today. Demo-complete, not production-complete.
**Category:** Education
**Showcase language:** English (ESL learner persona)
**Surface:** Web UI
**Video owner:** Sophia Liu

---

## 1. One-liner

Sologurus turns "I need IELTS 7.0 by December" into a test registration deadline, a curated resource set, and a day-by-day study plan sitting in your Notion and your calendar — in under three minutes, with no teacher and no subscription.

## 2. What judges need to see

The demo video is <3 minutes. Everything below is designed backward from that constraint. If a feature can't be shown in the video or verified by a judge in a sandbox, it isn't in scope.

**The 3-minute video arc:**

| Time | Beat |
|---|---|
| 0:00–0:20 | Problem framing: self-taught learners quit for structural reasons, not motivational ones. Ground it in the persona — a Vietnamese learner who needs IELTS 7.0 for PR and can't afford a prep school |
| 0:20–0:40 | Onboarding: language, city, goal, hours/week — four inputs |
| 0:40–1:10 | Agent runs live: test lookup → guidance → resources, tool calls visible on screen |
| 1:10–1:50 | Three strategically different plans generated; user picks one |
| 1:50–2:15 | Plan lands in Notion; calendar fills with sessions + 3 daily reminders |
| 2:15–3:00 | **How we built it:** Codex's role, GPT-5.6's role, the key architectural decision. In the Education category, close on the *learning* argument, not the stack |

That last 45 seconds is graded. Budget for it in the script, not as an afterthought.

## 3. Scope: in and out

### In (must work end to end in the demo)
- Onboarding: target language, level, country/city, goal, weekly hours
- **§1 Test Explorer** — tests for the language, formats, fees, centers in the user's city, next dates
- **§2 Study Guidance** — top 10 YouTube channels, top 5 forums, with rationale
- **§3 Resource Library** — top 5 each for listening/speaking/reading/writing + 10 TV shows
- **§4 Plan Builder** — 3 strategically distinct plans → pick one → write to Notion + calendar
- Three daily reminders as calendar events: morning start, noon check-in, night reflection

### Out (say so explicitly in the README — scoping judgment scores better than silent gaps)
- Auth / multi-user accounts (single-user demo, token in `.env`)
- Two-way sync back from Notion
- Adaptive re-planning from check-in data
- Placement testing
- Mobile app — web + agent CLI only
- Payment, analytics, monitoring

### Reduce risk here
| Risk | Hackathon decision |
|---|---|
| Notion OAuth flow eats half a day | Use a Notion **internal integration token** in `.env`. OAuth is a production concern, not a demo one. |
| Google Calendar OAuth consent screen verification | Ship **ICS file generation** as the primary path (works everywhere, instantly, for judges). Google Calendar API as a bonus if time allows. |
| Live web search is slow/flaky on stage | Cache the demo language's results to a fixture file; a `--live` flag runs it fresh. Disclose the cache in the README. |
| 10 languages is 10× the failure surface | **English ships fully.** Two or three more work if data allows. Depth > breadth for judging. |
| Judges can personally evaluate English recommendations | Double-edged: they *will* check whether your top-10 list is credible. Accuracy here is worth more than volume — a defensible ranked list of 10 beats a padded one. |

## 4. Architecture

```
  Web UI (Next.js)  ─────►  Agent Orchestrator (GPT-5.6, tool-calling loop)
                                   │
                                   ├─ tool: search_tests(language, country, city)
                                   ├─ tool: search_youtube(language, level, test)
                                   ├─ tool: search_forums(language)
                                   ├─ tool: search_resources(language, skill)
                                   ├─ tool: search_shows(language, level, region)
                                   ├─ tool: generate_plans(profile, duration, hours)
                                   ├─ tool: write_notion(plan)
                                   └─ tool: emit_calendar(plan)  → ICS + optional GCal
                                   │
                              JSON schemas enforced on every tool return
```

**Key decision to narrate in the video:** the agent is a **planner over structured tools**, not a chatbot that free-texts a study plan. Every section returns schema-validated JSON, so the plan generator composes real resource objects with real URLs rather than hallucinating a curriculum. That's the difference between a demo and a toy, and it's the thing judges reward.

## 5. Functional requirements

### 5.1 Onboarding
| ID | Requirement |
|---|---|
| ON-1 | Collect language, self-rated level, country, city, goal, target date, hours/week — 4 screens max |
| ON-2 | Prefill a "demo profile" button so a judge can reach the payoff in one click |

### 5.2 Test Explorer
| ID | Requirement |
|---|---|
| TE-1 | List recognized tests for the language (English → IELTS Academic/General, TOEFL iBT, PTE Academic, Cambridge C1/C2, Duolingo English Test) |
| TE-2 | Per test: level structure, sections, duration, fee, who accepts it |
| TE-3 | Test centers filtered to the user's country/city, with address + official registration URL |
| TE-4 | Next test date and registration deadline |
| TE-5 | Every fact carries a source link. **No unsourced dates or fees** — this is the one place a wrong answer really hurts a user, and judges probe it |
| TE-6 | English-specific: recommend *which* test fits the stated goal, with reasoning. This is a real decision ESL learners struggle with (IELTS vs. TOEFL for a US university; IELTS General vs. Academic for immigration) and it's a strong demo beat |

### 5.3 Study Guidance
| ID | Requirement |
|---|---|
| SG-1 | Top 10 YouTube channels: name, link, subs, last upload, "best for X", instruction language |
| SG-2 | Drop channels with no upload in 12 months; flag 6–12 months |
| SG-3 | Top 5 forums/communities: link, size, activity, beginner-friendly y/n |
| SG-4 | Ranking is a visible composite (reach × recency × level-fit × test-relevance), not raw subscriber count — show the rationale string in the UI |

### 5.4 Resource Library
| ID | Requirement |
|---|---|
| RL-1 | Top 5 each for listening, speaking, reading, writing |
| RL-2 | Per resource: type, cost (free/freemium/paid + price), level range, one-line use case |
| RL-3 | Free-first. Max 1 paid item per skill category |
| RL-4 | 10 TV shows: level suitability, where to watch, subtitle availability |

### 5.5 Plan Builder — *the demo centerpiece*
| ID | Requirement |
|---|---|
| PB-1 | User picks duration (1 / 3 / 6 months, or "until my test date") |
| PB-2 | Generate exactly 3 plans that differ by **strategy, not intensity**: **Test-First** (exam-format drilling), **Immersion-Led** (high input volume, media-heavy), **Balanced Four-Skill** |
| PB-3 | Each plan card shows: weekly hours, skill split, which §2/§3 resources it uses, milestones, honest expected outcome |
| PB-4 | Tasks are concrete and time-boxed — "25 min: BBC Learning English 6 Minute English ×2, shadow the second" not "practice listening" |
| PB-5 | Plan never exceeds declared weekly hours. Include slack days |
| PB-6 | Daily / weekly / monthly structure all present |

Three plans that are just light/medium/heavy is not a choice — it's one plan with a volume knob. The strategic split is what makes this look like a product rather than a prompt.

### 5.6 Write-out
| ID | Requirement |
|---|---|
| WO-1 | Notion: create a database with date, task, skill, resource link, duration, status, reflection |
| WO-2 | Calendar: one event per study session + 3 daily reminder events |
| WO-3 | Reminders: morning start (today's tasks), noon check-in (offer a shortened plan if nothing done), night reflection (mark done + 1-line log) |
| WO-4 | ICS download works with zero configuration — this is the judge-testable path |
| WO-5 | Writes are scoped to a Sologurus-owned page/calendar; never touch other user content |

## 6. Submission checklist

| Item | Requirement | Status |
|---|---|---|
| Working project | Runs from a clean clone per README | ☐ |
| Category selected | See §9 | ☐ |
| Project description | What it is + how it works | ☐ |
| Demo video | <3 min, public YouTube, **audio covering Codex AND GPT-5.6 usage** | ☐ |
| Repo URL | Public w/ license (MIT), or private + shared with `testing@devpost.com` and `build-week-event@openai.com` | ☐ |
| README | Setup, sample data, run instructions | ☐ |
| Codex/GPT-5.6 narrative | Where Codex accelerated work, where key decisions were made | ☐ |
| Codex `/feedback` session ID | From the session where core functionality was built | ☐ |
| Judge-testable path | Demo instance or seeded fixture mode requiring no rebuild | ☐ |

## 7. README outline (required deliverable)

```
# Sologurus
1. What it is — 3 sentences
2. Demo video link
3. Quickstart
     git clone → npm install → cp .env.example .env → npm run demo
     `npm run demo` boots the web UI on localhost:3000 with seeded fixtures:
       no API keys needed to see the full flow
     `npm run live` requires OPENAI_API_KEY, NOTION_TOKEN, (optional) GOOGLE_*
4. Sample data — demo profile: English / B1 / Ho Chi Minh City, Vietnam /
     goal: IELTS 7.0 for Canadian PR / target date: Dec 2026 / 8 hrs per week
5. Architecture — the diagram from §4
6. How we used Codex — see §8
7. How we used GPT-5.6 — see §8
8. Known limitations — the "Out of scope" list from §3, stated plainly
9. License — MIT
```

The zero-key `npm run demo` path matters more than it sounds. A judge who hits a missing API key stops evaluating and moves on.

## 8. Codex & GPT-5.6 narrative (graded — draft it deliberately)

This is explicitly called out as an evaluation criterion, so treat it as a deliverable rather than a retrospective. Log these as you build; reconstructing them at 2am is how teams lose points.

**Where Codex accelerated the work** — capture specifics, not "it wrote code":
- Scaffolding the tool-calling loop and JSON schema validation layer
- Generating the ICS emitter and Notion database-schema writer (fiddly, well-specified, high-leverage delegation)
- Refactoring the four search tools onto one shared retrieve-rank-validate interface
- Test fixtures and the seeded demo mode
- Note the concrete time saved: "X hours of boilerplate → Y minutes"

**Where GPT-5.6 does the product work at runtime:**
- Multi-step tool orchestration across the four sections
- Ranking and rationale generation (why *this* channel for *this* learner's level and test)
- Plan synthesis — composing structured resource objects into three strategically distinct schedules under a real hours constraint
- Constraint-checking its own output against declared availability

**Where humans made the key decisions** — judges specifically ask for this, and claiming the AI did everything reads worse than showing judgment:
- Structured tools over free-text generation (§4)
- Three plans by strategy, not intensity (§5.5)
- ICS-first over OAuth, to make the demo judge-testable (§3)
- One language deep instead of ten shallow

## 9. Decisions (locked)

| Question | Decision | Implication |
|---|---|---|
| Category | **Education** | Judging will weight learning outcomes and pedagogy, not just engineering. Make the *plan quality* argument explicit in the video — why three strategies, why time-boxed tasks, why free-first. |
| Showcase language | **English** | Test set is IELTS / TOEFL / PTE / Cambridge / Duolingo. Persona must be a non-native speaker in a non-English country, or the test-center lookup has nothing to show. |
| Surface | **Web UI** | Reads far better on video. But: a *minimal* UI over a working agent beats a rich UI over a fake one. Budget UI time last (§10 step 6). |
| Video owner | **Sophia Liu** | Owns script, recording, and the 45-second Codex/GPT-5.6 segment. Should start capturing build footage now, not after code freeze. |

### Consequences of picking English

**Good:** the richest public test data of any language, so §5.2 will be your most accurate section. The IELTS-vs-TOEFL recommendation (TE-6) is a genuinely useful decision-support moment that lands well on video.

**Watch out for:** judges are English speakers and *can* evaluate your recommendations directly, unlike with Japanese. A padded or stale top-10 list is visible to them instantly. Ranking rationale (SG-4) is doing real work here — show it in the UI.

**Persona note:** the learner must be located outside an English-speaking country. "Ho Chi Minh City, IELTS 7.0 for Canadian PR" gives you real test centers to plot, a real deadline, and a sympathetic stake. A learner in London studying English makes the test-center section look pointless.

## 10. Build order (ship-today priority)

1. Agent loop + tool schemas + seeded demo mode ← *nothing demos without this*
2. Plan Builder (§5.5) ← *the centerpiece; build it before the search sections*
3. ICS emitter + Notion writer ← *the payoff shot in the video*
4. Test Explorer (§5.2)
5. Study Guidance + Resource Library (§5.3, §5.4)
6. Web UI over the top
7. README + video *(Sophia — start the script at step 3, not step 7)*

Sections 4 and 5 can degrade to fixtures if time runs out. Steps 1–3 cannot — they are the demo.

**Parallel track for Sophia:** the video is a 3-minute artifact that takes far longer than 3 minutes to make, and it's a hard submission requirement. Record the "how we built it" segment (§8) against the architecture diagram as soon as the tool schemas are frozen at step 1 — that footage doesn't depend on the UI existing. Screen-capture the payoff shot (step 3, plan → Notion → calendar) the moment it first works, even if it's ugly; re-shoot later only if there's time.
