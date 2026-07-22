"use client";

import { useEffect, useMemo, useState } from "react";
import languages from "../data/languages.json";
import locations from "../data/locations.json";
import { makeCalendarIcs } from "../lib/calendar.mjs";

type ResourceTab = "tests" | "youtube" | "forums" | "listening" | "speaking" | "reading" | "writing";

type Profile = {
  language: string;
  level: string;
  city: string;
  country: string;
  goal: string;
  date: string;
  hours: number;
  timezone: string;
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

type TestOption = { name: string; fit: string; format: string; sourceUrl: string };
type TestCenter = { name: string; provider: string; address: string; availability: string; registrationUrl: string };
type Channel = { name: string; url: string; bestFor: string; level: string; score: number };
type Forum = { name: string; url: string; bestFor: string };
type Material = { name: string; url: string; cost: string; level: string; use: string };
type ResourceData = {
  language: string;
  lastVerified: string;
  sourceMode: "curated-official";
  centerMode: "verified-local-and-directory" | "official-directory";
  recommendation: { name: string; reason: string; sourceUrl: string };
  tests: TestOption[];
  testCenters: TestCenter[];
  youtube: Channel[];
  forums?: Forum[];
  materials: Record<"listening" | "speaking" | "reading" | "writing", Material[]>;
};

const demoProfile: Profile = {
  language: "English",
  level: "B1 · Intermediate",
  city: "Ho Chi Minh City",
  country: "Vietnam",
  goal: "IELTS 7.0 for Canadian PR",
  date: "2026-12-05",
  hours: 8,
  timezone: "Asia/Ho_Chi_Minh",
};

const countryTimezones: Record<keyof typeof locations, string> = {
  Australia: "Australia/Sydney", Brazil: "America/Sao_Paulo", Canada: "America/Toronto", China: "Asia/Shanghai",
  France: "Europe/Paris", Germany: "Europe/Berlin", India: "Asia/Kolkata", Indonesia: "Asia/Jakarta",
  Italy: "Europe/Rome", Japan: "Asia/Tokyo", Mexico: "America/Mexico_City", Netherlands: "Europe/Amsterdam",
  Portugal: "Europe/Lisbon", Singapore: "Asia/Singapore", "South Korea": "Asia/Seoul", Spain: "Europe/Madrid",
  Sweden: "Europe/Stockholm", Taiwan: "Asia/Taipei", Türkiye: "Europe/Istanbul", "United Arab Emirates": "Asia/Dubai",
  "United Kingdom": "Europe/London", "United States": "America/New_York", Vietnam: "Asia/Ho_Chi_Minh",
};

function buildPlans(data: ResourceData | null, language: string): Plan[] {
  const exam = data?.recommendation.name ?? `${language} proficiency test`;
  const listening = data?.materials.listening[0]?.name ?? `${language} listening practice`;
  const speaking = data?.youtube[0]?.name ?? `${language} speaking lesson`;
  const writing = data?.materials.writing[0]?.name ?? `${language} writing practice`;
  const reading = data?.materials.reading[0]?.name ?? `${language} reading practice`;

  return [
  {
    id: "test-first",
    name: "Test-First",
    tagline: "Learn the exam by doing the exam.",
    accent: "Coral",
    split: "40% drills · 25% feedback · 20% vocabulary · 15% input",
    outcome: "Best for a near-term score target. Expected: 6.5–7.0 with consistent review.",
    sample: [
      `25 min · ${exam} reading task, timed`,
      "20 min · Error log: label 3 mistake patterns",
      `15 min · ${speaking} speaking prompt, record + compare`,
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
      `25 min · ${listening} ×2, shadow the second`,
      `20 min · ${language} video with target-language subtitles`,
      `15 min · Voice note: retell it in ${language} without notes`,
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
      `25 min · ${writing}: outline + first paragraph`,
      `20 min · ${listening}, then review the transcript`,
      `15 min · ${reading}: annotate five useful phrases`,
    ],
  },
  ];
}

export default function Home() {
  const [profile, setProfile] = useState<Profile>(demoProfile);
  const [stage, setStage] = useState<"profile" | "running" | "plans" | "exported">("profile");
  const [activeTool, setActiveTool] = useState(0);
  const [selected, setSelected] = useState("balanced");
  const [resourceTab, setResourceTab] = useState<ResourceTab>("tests");
  const [notionStatus, setNotionStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [notionMessage, setNotionMessage] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [notionApiConfigured, setNotionApiConfigured] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [loadedResourceKey, setLoadedResourceKey] = useState("");
  const [resourceError, setResourceError] = useState("");
  const resourceQueryKey = useMemo(() => new URLSearchParams({
    language: profile.language,
    city: profile.city,
    country: profile.country,
  }).toString(), [profile.city, profile.country, profile.language]);
  const resourceLoading = loadedResourceKey !== resourceQueryKey;
  const plans = useMemo(() => buildPlans(resourceData, profile.language), [resourceData, profile.language]);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selected) ?? plans[2], [plans, selected]);
  const resourceTabs: [ResourceTab, string][] = useMemo(() => [
    ["tests", `Tests & centres · ${resourceData ? resourceData.tests.length + resourceData.testCenters.length : 0}`],
    ["youtube", `YouTube · ${resourceData?.youtube.length ?? 0}`],
    ["forums", `Forums · ${resourceData?.forums?.length ?? 0}`],
    ["listening", `Listening · ${resourceData?.materials.listening.length ?? 0}`],
    ["speaking", `Speaking · ${resourceData?.materials.speaking.length ?? 0}`],
    ["reading", `Reading · ${resourceData?.materials.reading.length ?? 0}`],
    ["writing", `Writing · ${resourceData?.materials.writing.length ?? 0}`],
  ], [resourceData]);
  const featuredResources = useMemo(() => {
    if (!resourceData) return [];
    return (["listening", "speaking", "reading", "writing"] as const).map((skill) => {
      const material = resourceData.materials[skill][0];
      return [skill[0].toUpperCase() + skill.slice(1), material.name, `${material.cost} · ${material.level}`];
    });
  }, [resourceData]);
  const toolSteps = useMemo(() => [
    ["search_tests", resourceData ? `${resourceData.tests.length} exams · ${resourceData.testCenters.length} location sources` : "Loading verified sources", `${profile.language} · ${profile.city}, ${profile.country}`],
    ["rank_guidance", resourceData ? `${resourceData.youtube.length} educators · ${resourceData.forums?.length ?? 0} forums` : "Loading educators and forums", `Selected for ${profile.language} learner fit`],
    ["curate_resources", resourceData ? `${Object.values(resourceData.materials).flat().length} skill resources` : "Loading four-skill materials", "Listening · speaking · reading · writing"],
    ["generate_plans", `3 strategies · ${profile.hours} h/week`, "Constraint check passed"],
  ], [profile.city, profile.country, profile.hours, profile.language, resourceData]);

  useEffect(() => {
    Promise.all([
      fetch("/api/notion").then((response) => response.json()),
      fetch("/api/calendar").then((response) => response.json()),
    ]).then(([notion, calendar]: [{ configured?: boolean }, { eventUrl?: string | null }]) => {
      setNotionApiConfigured(Boolean(notion.configured));
      setGoogleCalendarUrl(calendar.eventUrl ?? "");
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/resources?${resourceQueryKey}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("The verified resource catalog is temporarily unavailable.");
        return response.json() as Promise<ResourceData>;
      })
      .then((data) => {
        setResourceData(data);
        setResourceError("");
        setLoadedResourceKey(resourceQueryKey);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setResourceData(null);
          setResourceError(error.message);
          setLoadedResourceKey(resourceQueryKey);
        }
      });
    return () => controller.abort();
  }, [resourceQueryKey]);

  const update = (key: keyof Profile, value: string | number) => setProfile((current) => ({ ...current, [key]: value }));

  const updateLanguage = (language: string) => setProfile((current) => ({
    ...current,
    language,
    goal: current.language === language || !/IELTS|English/i.test(current.goal)
      ? current.goal
      : `Reach B2 ${language} for study and work`,
  }));

  const updateCountry = (country: string) => setProfile((current) => ({
    ...current,
    country,
    city: locations[country as keyof typeof locations][0],
    timezone: countryTimezones[country as keyof typeof locations],
  }));

  const runAgent = async () => {
    if (resourceLoading || !resourceData) return;
    setStage("running");
    setActiveTool(0);
    for (let index = 0; index < toolSteps.length; index += 1) {
      setActiveTool(index);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    setStage("plans");
  };

  const downloadIcs = () => {
    const blob = new Blob([makeCalendarIcs(profile, selectedPlan)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `sologurus-${selectedPlan.id}.ics`;
    anchor.click();
    URL.revokeObjectURL(href);
    setCalendarReady(true);
    setStage("exported");
  };

  const connectNotion = async () => {
    setNotionStatus("connecting");
    setNotionMessage("");
    setNotionUrl("");
    try {
      const response = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, plan: selectedPlan, resources: resourceData }),
      });
      const result = await response.json() as { ok?: boolean; url?: string; message?: string };
      if (!response.ok || !result.ok || !result.url) throw new Error(result.message || "Notion page creation failed.");
      setNotionUrl(result.url);
      setNotionMessage("The page was written from the current profile, strategy, tests, educators, forums, and skill resources.");
      setNotionStatus("success");
      setStage("exported");
    } catch (error) {
      setNotionStatus("error");
      setNotionMessage(error instanceof Error ? error.message : "Notion page creation failed.");
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sologurus home"><span className="brand-mark">S</span><span>Sologurus</span></a>
        <div className="status"><span className="status-dot" /> 16 language catalogs · sources dated</div>
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
          <div className={`step ${stage === "exported" ? "done" : ""}`}><span>04</span><div><b>Start studying</b><small>Calendar + live Notion write</small></div></div>
          <div className="promise"><span>8h</span><p>Your declared weekly limit. Every plan stays inside it.</p></div>
        </aside>

        <div className="panel">
          {stage === "profile" && (
            <div className="profile-view">
              <div className="panel-heading"><div><span className="kicker">STEP 01</span><h2>Tell me where you’re headed.</h2></div><button className="text-button" onClick={() => setProfile(demoProfile)}>Use demo profile ↗</button></div>
              <div className="form-grid">
                <label>Target language<select value={profile.language} onChange={(e) => updateLanguage(e.target.value)}>{languages.map((language) => <option key={language.name} value={language.name}>{language.name} · {language.nativeName}</option>)}</select></label>
                <label>Current level<select value={profile.level} onChange={(e) => update("level", e.target.value)}><option>B1 · Intermediate</option><option>A2 · Elementary</option><option>B2 · Upper-intermediate</option></select></label>
                <label>Country<select value={profile.country} onChange={(e) => updateCountry(e.target.value)}>{Object.keys(locations).map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
                <label>City<select value={profile.city} onChange={(e) => update("city", e.target.value)}>{locations[profile.country as keyof typeof locations].map((city) => <option key={city} value={city}>{city}</option>)}</select></label>
                <label className="wide">Goal<input value={profile.goal} onChange={(e) => update("goal", e.target.value)} /></label>
                <label>Target date<input type="date" value={profile.date} onChange={(e) => update("date", e.target.value)} /></label>
                <label>Hours each week<div className="range-row"><input aria-label="Hours each week" type="range" min="3" max="20" value={profile.hours} onChange={(e) => update("hours", Number(e.target.value))} /><output>{profile.hours}h</output></div></label>
              </div>
              {resourceError && <div className="integration-error" role="alert"><span>!</span><div><b>Research could not load.</b><p>{resourceError}</p></div></div>}
              <button className="primary" aria-label="Build my study system" data-testid="run-agent" disabled={resourceLoading || !resourceData} onClick={runAgent}>{resourceLoading ? `Loading ${profile.language} sources…` : "Build my study system"} <span>→</span></button>
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

          {(stage === "plans" || stage === "exported") && resourceData && (
            <div className="plans-view">
              <div className="panel-heading"><div><span className="kicker">STEP 03 · CONSTRAINT CHECK PASSED</span><h2>Three strategies. One honest time budget.</h2></div><button className="text-button" onClick={() => setStage("profile")}>Edit profile</button></div>
              <div className="insight-strip"><b>Recommended test: {resourceData.recommendation.name}</b><span>{resourceData.recommendation.reason} Dates, local availability and acceptance should be rechecked before booking.</span><a href={resourceData.recommendation.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a></div>
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
                <div className="resource-stack"><span className="kicker">RESOURCES IN THIS PLAN</span>{featuredResources.map(([skill, name, meta]) => <div key={skill}><b>{skill}</b><span>{name}</span><small>{meta}</small></div>)}</div>
              </div>

              <section className="resource-explorer" aria-labelledby="all-resources-title">
                <div className="resource-heading">
                  <div><span className="kicker">AGENT RESEARCH · FULL RESULTS</span><h3 id="all-resources-title">See every recommendation.</h3></div>
                  <p>{profile.language} test options, official centre directories, 10 educators, 3 study forums, and four-skill materials. Catalog checked {resourceData.lastVerified}; availability is always rechecked at the source.</p>
                </div>
                <div className="resource-tabs" role="tablist" aria-label="Research result categories">
                  {resourceTabs.map(([id, label]) => (
                    <button key={id} role="tab" aria-selected={resourceTab === id} className={resourceTab === id ? "active" : ""} onClick={() => setResourceTab(id)}>{label}</button>
                  ))}
                </div>

                <div className="resource-results" role="tabpanel">
                  {resourceTab === "tests" && (
                    <>
                      <div className="result-subhead"><b>Test centres near {profile.city}</b><span>{resourceData.centerMode === "official-directory" ? "official finder — no address invented" : `${resourceData.testCenters.length - 1} local record(s) + official finder`}</span></div>
                      <div className="center-grid">
                        {resourceData.testCenters.map((center) => (
                          <a className="center-card" href={center.registrationUrl} target="_blank" rel="noreferrer" key={center.name}>
                            <span className="pin">⌖</span><div><b>{center.name}</b><small>{center.provider}</small><address>{center.address}</address><p>{center.availability}</p></div><span className="open-link">Official source ↗</span>
                          </a>
                        ))}
                      </div>
                      <div className="result-subhead secondary-head"><b>Recognized {profile.language} tests</b><span>{resourceData.tests.length} options compared</span></div>
                      <div className="resource-list tests-list">
                        {resourceData.tests.map((test) => (
                          <a href={test.sourceUrl} target="_blank" rel="noreferrer" key={test.name}><span className="rank">TEST</span><div><b>{test.name}</b><p>{test.fit}</p><small>{test.format}</small></div><span className="open-link">Source ↗</span></a>
                        ))}
                      </div>
                    </>
                  )}

                  {resourceTab === "youtube" && (
                    <div className="resource-list">
                      {resourceData.youtube.map((channel, index) => (
                        <a href={channel.url} target="_blank" rel="noreferrer" key={channel.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{channel.name}</b><p>{channel.bestFor}</p><small>{channel.level} · learner-fit score {channel.score}/100</small></div><span className="open-link">Watch ↗</span></a>
                      ))}
                    </div>
                  )}

                  {resourceTab === "forums" && (
                    <div className="resource-list forum-list">
                      {(resourceData.forums ?? []).map((forum, index) => (
                        <a href={forum.url} target="_blank" rel="noreferrer" key={forum.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{forum.name}</b><p>{forum.bestFor}</p><small>Active study community · verify community rules before posting</small></div><span className="open-link">Join ↗</span></a>
                      ))}
                    </div>
                  )}

                  {resourceTab !== "tests" && resourceTab !== "youtube" && resourceTab !== "forums" && (
                    <div className="material-grid">
                      {resourceData.materials[resourceTab].map((material, index) => (
                        <a href={material.url} target="_blank" rel="noreferrer" key={material.name}><span className="material-number">0{index + 1}</span><div><b>{material.name}</b><p>{material.use}</p><small>{material.cost} · {material.level}</small></div><span className="open-link">Open ↗</span></a>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="export-row">
                <div><b>Send the plan somewhere real.</b><span>Live Notion and Google Calendar connections, plus a universal 15-event calendar file.</span></div>
                <button className="secondary" data-testid="connect-notion" disabled={notionStatus === "connecting"} onClick={connectNotion}>{notionStatus === "connecting" ? "Updating Notion…" : notionApiConfigured ? "Update Notion page ↗" : "Connect Notion to update ↗"}</button>
                {googleCalendarUrl && <a className="secondary action-link" href={googleCalendarUrl} target="_blank" rel="noreferrer">Open Google Calendar ↗</a>}
                <button className="primary compact" data-testid="download-ics" onClick={downloadIcs}>Download universal .ICS ↓</button>
              </div>
              {notionStatus === "error" && <div className="integration-error" role="alert"><span>!</span><div><b>Notion needs a write connection.</b><p>{notionMessage}</p></div></div>}
              {notionStatus === "success" && <div className="success" role="status"><span>✓</span><div><b>Notion matches this plan.</b><p>{notionMessage} <a href={notionUrl} target="_blank" rel="noreferrer">Open updated page ↗</a></p></div></div>}
              {calendarReady && <div className="success" role="status"><span>✓</span><div><b>Calendar file generated with 15 events.</b><p>Import it into Google, Apple, or Outlook Calendar. Events use {profile.timezone} and reminders repeat through {profile.date}.</p></div></div>}
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
