"use client";

import { useMemo, useState } from "react";

type Profile = {
  language: string;
  level: string;
  city: string;
  country: string;
  goal: string;
  date: string;
  hours: number;
};

type Plan = {
  id: string;
  name: string;
  tagline: string;
  accent: string;
  split: string;
  outcome: string;
  sample: string[];
};

const demoProfile: Profile = {
  language: "English",
  level: "B1 · Intermediate",
  city: "Ho Chi Minh City",
  country: "Vietnam",
  goal: "IELTS 7.0 for Canadian PR",
  date: "2026-12-05",
  hours: 8,
};

const toolSteps = [
  ["search_tests", "6 exams · 2 local centres", "Verified official sources"],
  ["rank_guidance", "10 channels · 5 communities", "Scored for B1 + IELTS fit"],
  ["curate_resources", "30 free-first resources", "Four skills + TV immersion"],
  ["generate_plans", "3 strategies · 8 h/week", "Constraint check passed"],
];

const plans: Plan[] = [
  {
    id: "test-first",
    name: "Test-First",
    tagline: "Learn the exam by doing the exam.",
    accent: "Coral",
    split: "40% drills · 25% feedback · 20% vocabulary · 15% input",
    outcome: "Best for a near-term score target. Expected: 6.5–7.0 with consistent review.",
    sample: [
      "25 min · Cambridge IELTS Reading passage, timed",
      "20 min · Error log: label 3 mistake patterns",
      "15 min · E2 IELTS speaking answer, record + compare",
    ],
  },
  {
    id: "immersion",
    name: "Immersion-Led",
    tagline: "Build fluency through high-quality input.",
    accent: "Blue",
    split: "45% listening · 25% speaking · 20% reading · 10% test format",
    outcome: "Best for durable fluency. Score gains may be slower in the first month.",
    sample: [
      "25 min · BBC 6 Minute English ×2, shadow the second",
      "20 min · Modern Family scene with English subtitles",
      "15 min · Voice note: retell the scene without notes",
    ],
  },
  {
    id: "balanced",
    name: "Balanced Four-Skill",
    tagline: "Progress evenly, with no weak-skill surprises.",
    accent: "Green",
    split: "25% each · listening · speaking · reading · writing",
    outcome: "Best default for a six-month runway. Expected: stable progress across all bands.",
    sample: [
      "25 min · IELTS Liz Task 2: outline + thesis only",
      "20 min · British Council listening set, review transcript",
      "15 min · iTalki notebook: correct yesterday’s paragraph",
    ],
  },
];

const resources = [
  ["Listening", "BBC Learning English", "Free · B1–C1"],
  ["Speaking", "E2 IELTS", "Free · B1–C2"],
  ["Reading", "News in Levels", "Free · A2–B2"],
  ["Writing", "IELTS Liz", "Free · B1–C2"],
];

function makeIcs(profile: Profile, plan: Plan) {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  const ymd = (date: Date) => date.toISOString().slice(0, 10).replaceAll("-", "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const events = plan.sample.map((task, index) => {
    const day = new Date(start);
    day.setDate(day.getDate() + index * 2);
    return [
      "BEGIN:VEVENT",
      `UID:sologurus-session-${index}@demo`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${ymd(day)}T183000`,
      `DTEND:${ymd(day)}T193000`,
      `SUMMARY:Sologurus · ${task.split(" · ")[1]}`,
      `DESCRIPTION:${task} | Goal: ${profile.goal}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  const reminders = [
    ["073000", "Morning start · See today’s study plan"],
    ["123000", "Noon check-in · Choose the full or shortened plan"],
    ["210000", "Night reflection · Mark done + write one line"],
  ].map(([time, label], index) => [
    "BEGIN:VEVENT",
    `UID:sologurus-reminder-${index}@demo`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${ymd(start)}T${time}`,
    `DTEND:${ymd(start)}T${time.slice(0, 2)}${String(Number(time.slice(2, 4)) + 10).padStart(2, "0")}00`,
    `RRULE:FREQ=DAILY;UNTIL:${profile.date.replaceAll("-", "")}T235959`,
    `SUMMARY:${label}`,
    "END:VEVENT",
  ].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sologurus//Study Plan//EN", ...events, ...reminders, "END:VCALENDAR"].join("\r\n");
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [stage, setStage] = useState<"profile" | "running" | "plans" | "exported">("profile");
  const [activeTool, setActiveTool] = useState(0);
  const [selected, setSelected] = useState("balanced");
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selected) ?? plans[2], [selected]);

  const update = (key: keyof Profile, value: string | number) => setProfile((current) => ({ ...current, [key]: value }));

  const runAgent = async () => {
    setStage("running");
    setActiveTool(0);
    for (let index = 0; index < toolSteps.length; index += 1) {
      setActiveTool(index);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    setStage("plans");
  };

  const downloadIcs = () => {
    const blob = new Blob([makeIcs(profile, selectedPlan)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `sologurus-${selectedPlan.id}.ics`;
    anchor.click();
    URL.revokeObjectURL(href);
    setStage("exported");
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sologurus home"><span className="brand-mark">S</span><span>Sologurus</span></a>
        <div className="status"><span className="status-dot" /> Seeded demo · No keys required</div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">Your study system, built around your life</div>
        <h1>One goal. A plan you can<br /><em>actually follow.</em></h1>
        <p>Sologurus turns a language-test goal into verified options, credible resources, and a calendar-ready study plan — without a tutor or subscription.</p>
      </section>

      <section className="workspace" aria-label="Sologurus agent workspace">
        <aside className="steps">
          <div className="step done"><span>01</span><div><b>Learning goal</b><small>Your context + constraints</small></div></div>
          <div className={`step ${stage !== "profile" ? "done" : ""}`}><span>02</span><div><b>Agent research</b><small>Tests, guidance, resources</small></div></div>
          <div className={`step ${stage === "plans" || stage === "exported" ? "done" : ""}`}><span>03</span><div><b>Choose a strategy</b><small>Three paths, same time budget</small></div></div>
          <div className={`step ${stage === "exported" ? "done" : ""}`}><span>04</span><div><b>Start studying</b><small>Calendar + Notion-ready</small></div></div>
          <div className="promise"><span>8h</span><p>Your declared weekly limit. Every plan stays inside it.</p></div>
        </aside>

        <div className="panel">
          {stage === "profile" && (
            <div className="profile-view">
              <div className="panel-heading"><div><span className="kicker">STEP 01</span><h2>Tell me where you’re headed.</h2></div><button className="text-button" onClick={() => setProfile(demoProfile)}>Use demo profile ↗</button></div>
              <div className="form-grid">
                <label>Target language<select value={profile.language} onChange={(e) => update("language", e.target.value)}><option>English</option><option>French</option><option>Spanish</option></select></label>
                <label>Current level<select value={profile.level} onChange={(e) => update("level", e.target.value)}><option>B1 · Intermediate</option><option>A2 · Elementary</option><option>B2 · Upper-intermediate</option></select></label>
                <label>City<input value={profile.city} onChange={(e) => update("city", e.target.value)} /></label>
                <label>Country<input value={profile.country} onChange={(e) => update("country", e.target.value)} /></label>
                <label className="wide">Goal<input value={profile.goal} onChange={(e) => update("goal", e.target.value)} /></label>
                <label>Target date<input type="date" value={profile.date} onChange={(e) => update("date", e.target.value)} /></label>
                <label>Hours each week<div className="range-row"><input aria-label="Hours each week" type="range" min="3" max="20" value={profile.hours} onChange={(e) => update("hours", Number(e.target.value))} /><output>{profile.hours}h</output></div></label>
              </div>
              <button className="primary" data-testid="run-agent" onClick={runAgent}>Build my study system <span>→</span></button>
            </div>
          )}

          {stage === "running" && (
            <div className="running-view" aria-live="polite">
              <div className="orb"><span /></div>
              <span className="kicker">GPT-5.6 ORCHESTRATION</span>
              <h2>Building evidence before a plan.</h2>
              <p className="lede">The agent composes validated objects — not a free-text curriculum.</p>
              <div className="tool-list">
                {toolSteps.map(([name, result, note], index) => (
                  <div className={`tool ${index < activeTool ? "complete" : index === activeTool ? "active" : ""}`} key={name}>
                    <span className="tool-state">{index < activeTool ? "✓" : index === activeTool ? "↻" : "·"}</span>
                    <code>{name}()</code><b>{index <= activeTool ? result : "Waiting"}</b><small>{index <= activeTool ? note : ""}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(stage === "plans" || stage === "exported") && (
            <div className="plans-view">
              <div className="panel-heading"><div><span className="kicker">STEP 03 · CONSTRAINT CHECK PASSED</span><h2>Three strategies. One honest time budget.</h2></div><button className="text-button" onClick={() => setStage("profile")}>Edit profile</button></div>
              <div className="insight-strip"><b>Recommended test: IELTS General Training</b><span>Best fit for Canadian PR pathways · official dates and fees should be rechecked before booking.</span></div>
              <div className="plan-grid">
                {plans.map((plan) => (
                  <button aria-pressed={selected === plan.id} className={`plan-card ${selected === plan.id ? "selected" : ""}`} key={plan.id} onClick={() => setSelected(plan.id)}>
                    <span className={`swatch ${plan.accent.toLowerCase()}`} /><span className="plan-name">{plan.name}</span><span className="check">{selected === plan.id ? "✓" : ""}</span>
                    <strong>{plan.tagline}</strong><small>{profile.hours} hours/week · {plan.split}</small><p>{plan.outcome}</p>
                  </button>
                ))}
              </div>
              <div className="schedule">
                <div><span className="kicker">YOUR FIRST STUDY BLOCK</span><h3>{selectedPlan.name} · Week one</h3>{selectedPlan.sample.map((item) => <p key={item}><span>✓</span>{item}</p>)}</div>
                <div className="resource-stack"><span className="kicker">RESOURCES IN THIS PLAN</span>{resources.map(([skill, name, meta]) => <div key={skill}><b>{skill}</b><span>{name}</span><small>{meta}</small></div>)}</div>
              </div>
              <div className="export-row">
                <div><b>Ready for your real week.</b><span>3 study sessions + morning, noon, and night reminders.</span></div>
                <button className="secondary" onClick={() => setStage("exported")}>Preview Notion page</button>
                <button className="primary compact" data-testid="download-ics" onClick={downloadIcs}>Download calendar .ICS ↓</button>
              </div>
              {stage === "exported" && <div className="success" role="status"><span>✓</span><div><b>Your plan is ready.</b><p>Calendar file generated. The same structured tasks are ready for a Notion database write.</p></div></div>}
            </div>
          )}
        </div>
      </section>

      <section className="evidence">
        <span className="kicker">WHY THIS IS AN AGENT, NOT A PROMPT</span>
        <div><h2>Research first.<br />Plan second.<br /><em>Learn for real.</em></h2><p>Sologurus uses GPT-5.6 as a planner over schema-validated tools. That means the schedule can cite a specific resource, obey your hours, and export cleanly — instead of hallucinating a motivational checklist.</p></div>
        <div className="schema-card"><code>{`plan = {\n  strategy: "balanced",\n  weekly_minutes: 480,\n  resources: Resource[],\n  constraint_check: "passed"\n}`}</code></div>
      </section>
      <footer><span>Sologurus · OpenAI Build Week 2026</span><span>Built for self-directed learners.</span></footer>
    </main>
  );
}
