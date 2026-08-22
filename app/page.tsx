"use client";

import { useEffect, useMemo, useState } from "react";
import languages from "../data/languages.json";
import locations from "../data/locations.json";
import { makeCalendarIcs } from "../lib/study/calendar.mjs";
import { assessFeasibility, buildProgressSeries, buildStudyPlan, type StudyPlanRow } from "../lib/study/learning-plan.mjs";

type Profile = {
  language: string;
  level: string;
  city: string;
  country: string;
  goal: string;
  date: string;
  dailyHours: number;
  studyDays: number;
  consistency: "steady" | "sometimes" | "starting";
  examExperience: "taken" | "similar" | "first";
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
type TvShow = { name: string; url: string; origin: string; genre: string; level: string };
type MockExam = { name: string; url: string; exam: string; access: string };
type Textbook = { name: string; authorPublisher: string; bestFor: string; level: string; url: string };
type CommunityLearner = {
  displayName: string;
  city: string;
  country: string;
  language: string;
  level: string;
  distanceMiles: number;
  availability: string;
  goal: string;
  interests: string[];
};
type JourneyStage = "profile" | "running" | "plans" | "exported" | "progress";
type ResourceData = {
  language: string;
  lastVerified: string;
  sourceMode: "curated-live-sources";
  centerMode: "verified-local-and-directory" | "official-directory";
  recommendation: { name: string; reason: string; sourceUrl: string };
  tests: TestOption[];
  testCenters: TestCenter[];
  youtube: Channel[];
  forums?: Forum[];
  tvShows: TvShow[];
  mockExams: MockExam[];
  textbooks: Textbook[];
  materials: Record<"listening" | "speaking" | "reading" | "writing", Material[]>;
};

type ConsoleLinks = { root: string; models: string; mcpServers: string };
type GatewayInfo = {
  gateway: {
    configured: boolean;
    host: string;
    primaryModel: string;
    fallbackModels: string[];
    inputGuardrails: string[];
    outputGuardrails: string[];
    tenant: string;
    costCenter: string;
    environment: string;
    console: ConsoleLinks;
  };
  models: string[];
  modelsOk: boolean;
  modelsError: string;
  features: Array<{ id: string; label: string; purpose: string; dailyCallCeiling: number }>;
  privacy: string[];
  degradedMode: string;
};
type Telemetry = {
  model: string;
  modelChain: string[];
  attempts: Array<{ model: string; status: number; latencyMs: number; error: string }>;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  estimatedCostUsd: number;
  guardrails: { input: string[]; output: string[] };
  promptLogging: boolean;
  degraded: boolean;
};
type Budget = { remainingCalls: number; ceilingCalls: number; remainingTokens: number; ceilingTokens: number; used: { calls: number; tokens: number; costUsd: number } };
type Synthesis = {
  briefing: string;
  testRationale: string;
  riskFlags: Array<{ title: string; detail: string }>;
  focusByPhase: Array<{ phase: string; emphasis: string; why: string }>;
  citations: string[];
};
type AgentResult = {
  source: "gateway" | "deterministic";
  note: string;
  learnerId: string;
  synthesis: Synthesis;
  grounding: { kept: string[]; dropped: string[] };
  telemetry: Telemetry | null;
  budget: Budget;
};
type McpTool = { name: string; description: string; permitted: boolean; arguments: string[] };
type McpAction = {
  id: string;
  label: string;
  server: string;
  tool: string;
  description: string;
  available: boolean;
  reason: string;
};
type McpInfo = {
  console: ConsoleLinks;
  broker: { configured: boolean; baseUrl: string; servers: Array<{ label: string; integrationId: string }>; skills: string[]; notionParentConfigured: boolean };
  listings: Array<{ ok: boolean; server: string; tools: McpTool[]; latencyMs: number; error: string }>;
  actions: McpAction[];
  permittedCount: number;
  discoveredCount: number;
  transport: string;
  note: string;
  calendarNote: string;
};
type McpDispatch = {
  ok?: boolean;
  blocked?: boolean;
  action?: string;
  message?: string;
  output?: string;
  pageRef?: string;
  completedDays?: number[] | null;
  telemetry?: { server: string; tool: string; latencyMs: number; permitted: boolean; transport: string };
  budget?: Budget | null;
};
type WritingFeedback = {
  source: "gateway" | "offline";
  note: string;
  exam: string;
  wordCount: number;
  redactions: Array<{ type: string; count: number }>;
  feedback: {
    scored: boolean;
    bandEstimate: string;
    summary: string;
    strengths: string[];
    fixes: Array<{ issue: string; excerpt: string; rewrite: string }>;
    nextTask: string;
  };
  telemetry: Telemetry | null;
  budget: Budget;
};

const journeyStages: { id: JourneyStage; label: string; note: string }[] = [
  { id: "profile", label: "Learning goal", note: "Context + constraints" },
  { id: "running", label: "Agent research", note: "Tests + resources" },
  { id: "plans", label: "Choose a strategy", note: "Three distinct paths" },
  { id: "exported", label: "Start studying", note: "Schedule + integrations" },
  { id: "progress", label: "Track progress", note: "Daily + weekly + monthly" },
];

const demoProfile: Profile = {
  language: "English",
  level: "B1 · Intermediate",
  city: "Ho Chi Minh City",
  country: "Vietnam",
  goal: "IELTS 7.0 for Canadian PR",
  date: "2026-12-05",
  dailyHours: 1.5,
  studyDays: 6,
  consistency: "steady",
  examExperience: "similar",
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
  const listening = data?.materials.listening[0]?.name ?? `${language} listening practice`;
  const speaking = data?.youtube[0]?.name ?? `${language} speaking lesson`;
  const writing = data?.materials.writing[0]?.name ?? `${language} writing practice`;
  const reading = data?.materials.reading[0]?.name ?? `${language} reading practice`;
  const tvShow = data?.tvShows?.[0]?.name ?? `${language} TV episode`;
  const mockExam = data?.mockExams?.[0]?.name ?? `${language} mock exam`;

  return [
  {
    id: "test-first",
    name: "Test-First",
    tagline: "Learn the exam by doing the exam.",
    accent: "Coral",
    split: "40% drills · 25% feedback · 20% vocabulary · 15% input",
    outcome: "Best for a near-term score target. Expected: 6.5–7.0 with consistent review.",
    sample: [
      `25 min · ${mockExam}, timed`,
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
      `20 min · ${tvShow} with target-language subtitles`,
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
  const [stage, setStage] = useState<JourneyStage>("profile");
  const [unlockedStage, setUnlockedStage] = useState(0);
  const [researchRunning, setResearchRunning] = useState(false);
  const [activeTool, setActiveTool] = useState(0);
  const [selected, setSelected] = useState("balanced");
  const [calendarReady, setCalendarReady] = useState(false);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  // The only handle Sologurus keeps on Notion: a page reference returned by the
  // gateway. There is no token here to keep.
  const [notionPlanRef, setNotionPlanRef] = useState("");
  const [progressView, setProgressView] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [progressSyncStatus, setProgressSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [progressSyncMessage, setProgressSyncMessage] = useState("");
  const [gatewayInfo, setGatewayInfo] = useState<GatewayInfo | null>(null);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [mcpInfo, setMcpInfo] = useState<McpInfo | null>(null);
  const [mcpDispatch, setMcpDispatch] = useState<McpDispatch | null>(null);
  const [mcpStatus, setMcpStatus] = useState<"idle" | "dispatching">("idle");
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [agentError, setAgentError] = useState("");
  const [writingPrompt, setWritingPrompt] = useState("");
  const [writingSample, setWritingSample] = useState("");
  const [writingResult, setWritingResult] = useState<WritingFeedback | null>(null);
  const [writingStatus, setWritingStatus] = useState<"idle" | "marking" | "success" | "error">("idle");
  const [writingMessage, setWritingMessage] = useState("");
  const [resourceData, setResourceData] = useState<ResourceData | null>(null);
  const [loadedResourceKey, setLoadedResourceKey] = useState("");
  const [resourceError, setResourceError] = useState("");
  const [communityOpen, setCommunityOpen] = useState(false);
  const [communityLocation, setCommunityLocation] = useState("");
  const [communityCoordinates, setCommunityCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [communityLocationStatus, setCommunityLocationStatus] = useState<"idle" | "locating" | "ready" | "error">("idle");
  const [communityLocationMessage, setCommunityLocationMessage] = useState("Location permission has not been requested.");
  const [communityLocationAttribution, setCommunityLocationAttribution] = useState("");
  const [communityLanguage, setCommunityLanguage] = useState(demoProfile.language);
  const [communityRadius, setCommunityRadius] = useState(10);
  const [communityResults, setCommunityResults] = useState<CommunityLearner[]>([]);
  const [communityStatus, setCommunityStatus] = useState<"idle" | "searching" | "success" | "error">("idle");
  const [communityMessage, setCommunityMessage] = useState("");
  const [communityDiscoveryLinks, setCommunityDiscoveryLinks] = useState<Array<{ name: string; url: string }>>([]);
  const resourceQueryKey = useMemo(() => new URLSearchParams({
    language: profile.language,
    city: profile.city,
    country: profile.country,
  }).toString(), [profile.city, profile.country, profile.language]);
  const resourceLoading = loadedResourceKey !== resourceQueryKey;
  const plans = useMemo(() => buildPlans(resourceData, profile.language), [resourceData, profile.language]);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selected) ?? plans[2], [plans, selected]);
  const currentStageIndex = journeyStages.findIndex((item) => item.id === stage);
  const feasibility = useMemo(() => assessFeasibility(profile), [profile]);
  const studyPlan = useMemo(
    () => resourceData ? buildStudyPlan(profile, selectedPlan, resourceData) : [],
    [profile, resourceData, selectedPlan],
  );
  const progressSeries = useMemo(
    () => buildProgressSeries(studyPlan, completedDays, progressView),
    [completedDays, progressView, studyPlan],
  );
  const completionPercent = studyPlan.length > 0 ? Math.round(completedDays.length / studyPlan.length * 100) : 0;
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
    ["curate_resources", resourceData ? `${Object.values(resourceData.materials).flat().length} skill resources · ${resourceData.tvShows.length} TV shows · ${resourceData.textbooks.length} textbooks` : "Loading four-skill materials", "Listening · speaking · reading · writing · immersion"],
    ["match_mock_exams", resourceData ? `${resourceData.mockExams.length} exam simulators` : "Loading mock platforms", `Matched to ${resourceData?.recommendation.name ?? profile.language}`],
    ["synthesize_plan", `3 strategies · ${feasibility.weeklyHours} h/week`, gatewayInfo?.gateway.configured
      ? `TrueFoundry AI Gateway · ${gatewayInfo.gateway.primaryModel}`
      : "Deterministic planner · gateway not configured"],
  ], [feasibility.weeklyHours, gatewayInfo, profile.city, profile.country, profile.language, resourceData]);

  useEffect(() => {
    Promise.all([
      fetch("/api/calendar").then((response) => response.json()),
      fetch("/api/gateway").then((response) => response.json()),
      fetch("/api/mcp").then((response) => response.json()),
    ]).then(([calendar, gateway, mcp]: [{ eventUrl?: string | null }, GatewayInfo, McpInfo]) => {
      setGoogleCalendarUrl(calendar.eventUrl ?? "");
      setGatewayInfo(gateway);
      setMcpInfo(mcp);
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
    setCompletedDays([]);
    setNotionPlanRef("");
    setMcpDispatch(null);
    setAgentResult(null);
    setAgentError("");
    setWritingResult(null);
    setWritingStatus("idle");
    setStage("running");
    setUnlockedStage((current) => Math.max(current, 1));
    setResearchRunning(true);
    setActiveTool(0);

    // The retrieval steps read the verified catalog; the final step is a real
    // gateway call, so the walkthrough runs alongside it rather than after it.
    const synthesis = fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, feasibility }),
    })
      .then(async (response) => {
        const result = await response.json() as AgentResult & { ok?: boolean; message?: string };
        if (!response.ok || !result.ok) throw new Error(result.message || "The planning layer did not respond.");
        return result;
      })
      .then((result) => { setAgentResult(result); setAgentError(""); })
      .catch((error: unknown) => {
        setAgentResult(null);
        setAgentError(error instanceof Error ? error.message : "The planning layer did not respond.");
      });

    for (let index = 0; index < toolSteps.length - 1; index += 1) {
      setActiveTool(index);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    setActiveTool(toolSteps.length - 1);
    await synthesis;
    setResearchRunning(false);
    setUnlockedStage((current) => Math.max(current, 2));
  };

  const dispatchMcpAction = async (actionId: string) => {
    setMcpStatus("dispatching");
    setMcpDispatch(null);
    try {
      // The browser names an intent. The server owns the tool binding and builds
      // the payload, so no arbitrary tool call can be crafted from here.
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionId, profile, plan: selectedPlan, feasibility, studyPlan, pageRef: notionPlanRef }),
      });
      const result = await response.json() as McpDispatch;
      setMcpDispatch(result);
      if (result.pageRef) setNotionPlanRef(result.pageRef);
      if (Array.isArray(result.completedDays)) setCompletedDays(result.completedDays);
    } catch (error) {
      setMcpDispatch({ ok: false, message: error instanceof Error ? error.message : "The action could not be dispatched." });
    } finally {
      setMcpStatus("idle");
    }
  };

  const requestWritingFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWritingStatus("marking");
    setWritingMessage("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, sample: writingSample, prompt: writingPrompt }),
      });
      const result = await response.json() as WritingFeedback & { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "The writing sample could not be marked.");
      setWritingResult(result);
      setWritingStatus("success");
    } catch (error) {
      setWritingResult(null);
      setWritingStatus("error");
      setWritingMessage(error instanceof Error ? error.message : "The writing sample could not be marked.");
    }
  };

  const downloadIcs = () => {
    const blob = new Blob([makeCalendarIcs({ ...profile, hours: feasibility.weeklyHours }, selectedPlan)], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `sologurus-${selectedPlan.id}.ics`;
    anchor.click();
    URL.revokeObjectURL(href);
    setCalendarReady(true);
  };

  const toggleStudyDay = (day: number) => {
    setCompletedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b));
  };

  const syncNotionProgress = async () => {
    if (!notionPlanRef) return;
    setProgressSyncStatus("syncing");
    setProgressSyncMessage("");
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notion-plan-progress", profile, pageRef: notionPlanRef }),
      });
      const result = await response.json() as McpDispatch;
      if (!response.ok || !result.ok || !Array.isArray(result.completedDays)) {
        throw new Error(result.message || "Could not read progress from the plan page.");
      }
      setCompletedDays(result.completedDays);
      setProgressSyncStatus("success");
      setProgressSyncMessage(`Read ${result.completedDays.length} ticked session(s) back through notion/notion-fetch in ${result.telemetry?.latencyMs ?? 0} ms.`);
    } catch (error) {
      setProgressSyncStatus("error");
      setProgressSyncMessage(error instanceof Error ? error.message : "Could not read progress from the plan page.");
    }
  };

  const toggleCommunity = () => {
    setCommunityOpen((current) => {
      if (!current) setCommunityLanguage(profile.language);
      return !current;
    });
  };

  const locateCommunity = async () => {
    setCommunityLocationStatus("locating");
    setCommunityLocationMessage("Waiting for browser location permission…");
    setCommunityStatus("idle");
    setCommunityResults([]);
    if (!navigator.geolocation) {
      setCommunityLocationStatus("error");
      setCommunityLocationMessage("This browser does not support location access.");
      return;
    }
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 });
      });
      const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const query = new URLSearchParams({ latitude: String(coordinates.latitude), longitude: String(coordinates.longitude) });
      const response = await fetch(`/api/community/location?${query}`, { cache: "no-store" });
      const result = await response.json() as { label?: string; attribution?: string; message?: string };
      if (!response.ok || !result.label) throw new Error(result.message || "Your location could not be resolved.");
      setCommunityCoordinates(coordinates);
      setCommunityLocation(result.label);
      setCommunityLocationAttribution(result.attribution ?? "");
      setCommunityLocationStatus("ready");
      setCommunityLocationMessage("Live device location ready. Coordinates are not saved to your profile.");
    } catch (error) {
      setCommunityCoordinates(null);
      setCommunityLocation("");
      setCommunityLocationStatus("error");
      const denied = typeof error === "object" && error !== null && "code" in error && error.code === 1;
      setCommunityLocationMessage(denied ? "Location permission was denied. Allow location access in your browser and try again." : error instanceof Error ? error.message : "Your location could not be resolved.");
    }
  };

  const searchCommunity = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!communityCoordinates) {
      setCommunityStatus("error");
      setCommunityMessage("Use your current location before searching for nearby learners.");
      return;
    }
    setCommunityStatus("searching");
    setCommunityMessage("");
    try {
      const query = new URLSearchParams({
        language: communityLanguage,
        location: communityLocation,
        latitude: String(communityCoordinates.latitude),
        longitude: String(communityCoordinates.longitude),
        radius: String(communityRadius),
      });
      const response = await fetch(`/api/community?${query}`, { cache: "no-store" });
      const result = await response.json() as {
        matches?: CommunityLearner[];
        discoveryLinks?: Array<{ name: string; url: string }>;
        privacy?: string;
        message?: string;
      };
      if (!response.ok || !result.matches) throw new Error(result.message || "Community search is temporarily unavailable.");
      setCommunityResults(result.matches);
      setCommunityDiscoveryLinks(result.discoveryLinks ?? []);
      setCommunityMessage(result.privacy ?? "");
      setCommunityStatus("success");
    } catch (error) {
      setCommunityResults([]);
      setCommunityStatus("error");
      setCommunityMessage(error instanceof Error ? error.message : "Community search is temporarily unavailable.");
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Sologurus home"><span className="brand-mark">S</span><span>Sologurus</span></a>
        <nav className="top-actions" aria-label="Account and project links">
          <a className="top-link github-link" href="https://github.com/Dec444/sologurus-demo" target="_blank" rel="noreferrer"><span aria-hidden="true">⌘</span> GitHub</a>
          <button className={`account-link connection-toggle ${gatewayInfo?.gateway.configured ? "connected" : ""}`} aria-expanded={connectionOpen} aria-controls="connection-panel" onClick={() => setConnectionOpen((current) => !current)}>
            <span className="account-dot" />
            <span><b>TrueFoundry</b><small>{gatewayInfo ? (gatewayInfo.gateway.configured ? `${gatewayInfo.models.length || "—"} models` : "Not connected") : "Checking…"}</small></span>
          </button>
          <button className="community-toggle" aria-expanded={communityOpen} aria-controls="community-finder" onClick={toggleCommunity}>Community <span>{communityOpen ? "×" : "↘"}</span></button>
        </nav>
      </header>

      {connectionOpen && (
        <section className="connection-panel" id="connection-panel" aria-labelledby="connection-title">
          <div className="connection-intro">
            <span className="kicker">YOUR TRUEFOUNDRY ACCOUNT</span>
            <h2 id="connection-title">Sologurus runs on the platform you control.</h2>
            <p>
              This app ships no provider list and no integration secrets. It reflects whatever your own TrueFoundry
              control plane exposes. Personal workspace integrations are planned separately.
            </p>
          </div>

          <div className="connection-grid">
            <article className={`connection-card ${gatewayInfo?.gateway.configured ? "live" : ""}`}>
              <div className="connection-card-head">
                <span className="mcp-chip"><i aria-hidden="true">◆</i>AI Gateway</span>
                <b>{gatewayInfo?.gateway.configured ? `${gatewayInfo.models.length} model${gatewayInfo.models.length === 1 ? "" : "s"}` : "Not connected"}</b>
              </div>
              {gatewayInfo?.gateway.configured ? (
                <>
                  <p>Requests route to <code>{gatewayInfo.gateway.primaryModel}</code>{gatewayInfo.gateway.fallbackModels.length > 0 ? `, falling back to ${gatewayInfo.gateway.fallbackModels.join(", ")}` : ", with no fallback configured"}.</p>
                  {gatewayInfo.models.length > 0 ? (
                    <div className="connection-tags">{gatewayInfo.models.slice(0, 8).map((model) => <span key={model}>{model}</span>)}</div>
                  ) : <p className="connection-warn">{gatewayInfo.modelsError ? `Could not list models: ${gatewayInfo.modelsError}` : "No models are connected to this account yet."}</p>}
                </>
              ) : <p>Add a TrueFoundry API key to this deployment, then connect any of the 250+ supported models in your console.</p>}
              {gatewayInfo?.gateway.console.models
                ? <a className="connection-link" href={gatewayInfo.gateway.console.models} target="_blank" rel="noreferrer">Add or change models ↗</a>
                : <small className="connection-hint">Set <code>TFY_CONSOLE_URL</code> to link straight to your control plane.</small>}
            </article>

            <article className="connection-card">
              <div className="connection-card-head">
                <span className="mcp-chip"><i aria-hidden="true">◈</i>Personal integrations</span>
                <b>Coming later</b>
              </div>
              <p>Notion sync will return when Sologurus supports secure, per-learner account connections.</p>
              <small className="connection-hint">This public demo does not request or store a personal workspace credential.</small>
            </article>

            <article className={`connection-card ${gatewayInfo?.gateway.inputGuardrails.length ? "live" : ""}`}>
              <div className="connection-card-head">
                <span className="mcp-chip"><i aria-hidden="true">◉</i>Policy</span>
                <b>{gatewayInfo?.gateway.inputGuardrails.length ? `${gatewayInfo.gateway.inputGuardrails.length + gatewayInfo.gateway.outputGuardrails.length} guardrails` : "No guardrails"}</b>
              </div>
              <p>
                Tagged <code>{gatewayInfo?.gateway.tenant ?? "—"}</code> / <code>{gatewayInfo?.gateway.costCenter ?? "—"}</code> on every request, so your budget and
                rate-limit rules can match on it. {gatewayInfo?.features.length ?? 0} AI features run under per-learner ceilings.
              </p>
              {gatewayInfo?.gateway.console.root
                ? <a className="connection-link" href={gatewayInfo.gateway.console.root} target="_blank" rel="noreferrer">Open the console ↗</a>
                : <small className="connection-hint">Point <code>TFY_GATEWAY_BASE_URL</code> at your control plane and the console links appear.</small>}
            </article>
          </div>
          <p className="connection-foot">{gatewayInfo?.degradedMode}</p>
        </section>
      )}

      {communityOpen && (
        <section className="community-finder" id="community-finder" aria-labelledby="community-title">
          <div className="community-intro">
            <span className="kicker">LOCAL LEARNER COMMUNITY</span>
            <h2 id="community-title">Find your language people nearby.</h2>
            <p>Use your real device location to calculate nearby matches by target language and travel radius. Coordinates are used for this search only and are not saved to your learner profile.</p>
          </div>
          <form className="community-search" onSubmit={searchCommunity}>
            <label>Target language<select value={communityLanguage} onChange={(event) => setCommunityLanguage(event.target.value)}>{languages.map((language) => <option key={language.name} value={language.name}>{language.name}</option>)}</select></label>
            <div className={`real-location ${communityLocationStatus}`}>
              <span>Real location</span>
              <div><b>{communityLocationStatus === "ready" ? communityLocation : communityLocationMessage}</b>{communityLocationStatus === "ready" && <small>{communityLocationMessage}</small>}</div>
              <button type="button" onClick={locateCommunity} disabled={communityLocationStatus === "locating"}>{communityLocationStatus === "locating" ? "Locating…" : communityLocationStatus === "ready" ? "Refresh location" : "Use my location"}</button>
            </div>
            <label>Search radius<select value={communityRadius} onChange={(event) => setCommunityRadius(Number(event.target.value))}><option value={5}>Within 5 miles</option><option value={10}>Within 10 miles</option><option value={25}>Within 25 miles</option><option value={50}>Within 50 miles</option><option value={100}>Within 100 miles</option></select></label>
            <button className="primary compact" disabled={communityStatus === "searching" || !communityCoordinates}>{communityStatus === "searching" ? "Searching…" : "Find learners →"}</button>
          </form>
          <div className="location-attribution">{communityLocationAttribution && <><span>{communityLocationAttribution}</span><a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noreferrer">OpenStreetMap policy ↗</a></>}</div>
          {communityStatus === "idle" && <div className="community-empty"><span>◎</span><p>Grant location access, choose your language and radius, then search for nearby opt-in learner profiles.</p></div>}
          {communityStatus === "error" && <div className="integration-error" role="alert"><span>!</span><div><b>Community search needs attention.</b><p>{communityMessage}</p></div></div>}
          {communityStatus === "success" && (
            <div className="community-results" aria-live="polite">
              <div className="community-results-heading"><b>{communityResults.length} learner{communityResults.length === 1 ? "" : "s"} found within {communityRadius} miles of {communityLocation}</b><span>Real-distance matches · preview profiles</span></div>
              {communityResults.length > 0 ? (
                <div className="community-grid">
                  {communityResults.map((learner) => (
                    <article className="learner-card" key={`${learner.displayName}-${learner.city}`}>
                      <div className="learner-avatar" aria-hidden="true">{learner.displayName.slice(0, 1)}</div>
                      <div><div className="learner-name"><b>{learner.displayName}</b><span>{learner.distanceMiles} mi</span></div><p>{learner.level} {learner.language} · {learner.goal}</p><small>{learner.city} · {learner.availability}</small><div className="interest-row">{learner.interests.map((interest) => <span key={interest}>{interest}</span>)}</div></div>
                    </article>
                  ))}
                </div>
              ) : <div className="community-empty compact-empty"><span>○</span><p>No opt-in preview profiles match yet. Try a wider radius or open a public language-exchange directory.</p></div>}
              <div className="community-discovery"><p>{communityMessage}</p><div>{communityDiscoveryLinks.map((link) => <a href={link.url} target="_blank" rel="noreferrer" key={link.name}>{link.name} ↗</a>)}</div></div>
            </div>
          )}
        </section>
      )}

      <section className="hero" id="top">
        <div className="eyebrow">Independent learning, intelligently designed</div>
        <h1>Better direction.<br /><em>Smarter study.</em></h1>
        <p>Sologurus turns a language-test goal into verified options, credible resources, and a calendar-ready study plan — running entirely on the TrueFoundry account you control.</p>
        <a className="hero-cta" href="#planner">Build my study system</a>
        <div className="hero-visual" aria-label="A preview of a personalized Sologurus study plan">
          <div className="visual-orb" />
          <div className="visual-card visual-card-main"><span>STUDY PULSE</span><b>Balanced plan ready</b><small>1.5 hours / day · feasibility checked</small></div>
          <div className="visual-card visual-card-score"><span>READINESS</span><b>84</b><small>goal fit</small></div>
          <div className="visual-card visual-card-source"><span>SOURCES</span><b>Verified</b><small>language + location matched</small></div>
        </div>
        <ul className="hero-proof" aria-label="Sologurus benefits">
          <li><span>✓</span>Research matched to your language and location</li>
          <li><span>✓</span>Three strategies tailored to your goal</li>
          <li><span>✓</span>Runs on your own TrueFoundry models and MCP servers</li>
        </ul>
        <div className="hero-metrics" aria-hidden="true">
          <div className="metric-card metric-dark"><span>RESEARCH SET</span><b>10 + 3 + 10</b><small>educators · forums · TV shows</small></div>
          <div className="metric-card metric-blue"><span>PROGRESS</span><b>3 views</b><small>daily · weekly · monthly</small></div>
        </div>
      </section>

      <section className="workspace-intro">
        <span className="kicker">PERSONAL STUDY SYSTEM</span>
        <h2>A learning plan designed around<br />your real life</h2>
      </section>

      <section className="workspace" id="planner" aria-label="Sologurus agent workspace">
        <nav className="steps" aria-label="Study-system pages">
          {journeyStages.map((item, index) => (
            <button
              className={`step ${index < currentStageIndex ? "done" : ""} ${index === currentStageIndex ? "active" : ""}`}
              disabled={index > unlockedStage}
              aria-current={index === currentStageIndex ? "step" : undefined}
              onClick={() => setStage(item.id)}
              key={item.id}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div><b>{item.label}</b><small>{item.note}</small></div>
            </button>
          ))}
        </nav>

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
                <label>Study days each week<select value={profile.studyDays} onChange={(e) => update("studyDays", Number(e.target.value))}><option value={3}>3 days</option><option value={4}>4 days</option><option value={5}>5 days</option><option value={6}>6 days</option><option value={7}>7 days</option></select></label>
                <label>Recent study consistency<select value={profile.consistency} onChange={(e) => update("consistency", e.target.value)}><option value="steady">I study most weeks</option><option value="sometimes">I study some weeks</option><option value="starting">I am building the habit now</option></select></label>
                <label>Exam experience<select value={profile.examExperience} onChange={(e) => update("examExperience", e.target.value)}><option value="taken">I have taken this test</option><option value="similar">I have taken a similar test</option><option value="first">This is my first language test</option></select></label>
                <label className="wide">Estimated hours on each study day<div className="range-row"><input aria-label="Estimated hours on each study day" type="range" min="0.5" max="6" step="0.5" value={profile.dailyHours} onChange={(e) => update("dailyHours", Number(e.target.value))} /><output>{profile.dailyHours}h</output></div></label>
              </div>
              <div className={`feasibility-card ${feasibility.status}`} role="status">
                <div><span>{feasibility.status === "practical" ? "✓" : feasibility.status === "tight" ? "!" : "×"}</span><div><b>{feasibility.title}</b><p>{feasibility.advice}</p></div></div>
                <dl><div><dt>Effective time</dt><dd>{feasibility.availableHours}h</dd></div><div><dt>Estimated need</dt><dd>{feasibility.neededHours}h</dd></div><div><dt>Weekly plan</dt><dd>{feasibility.weeklyHours}h</dd></div></dl>
              </div>
              {resourceError && <div className="integration-error" role="alert"><span>!</span><div><b>Research could not load.</b><p>{resourceError}</p></div></div>}
              <button className="primary" aria-label="Build my study system" data-testid="run-agent" disabled={resourceLoading || !resourceData} onClick={runAgent}>{resourceLoading ? `Loading ${profile.language} sources…` : "Build my study system"} <span>→</span></button>
            </div>
          )}

          {stage === "running" && resourceData && (
            <div className="research-page">
              {researchRunning ? (
                <div className="running-view" aria-live="polite">
                  <div className="orb"><span /></div>
                  <span className="kicker">STEP 02 · GOVERNED ORCHESTRATION</span>
                  <h2>Building evidence before a plan.</h2>
                  <p className="lede">Retrieval runs over the verified catalog; the synthesis call is routed, guardrailed and metered through the TrueFoundry AI Gateway.</p>
                  <div className="tool-list">
                    {toolSteps.map(([name, result, note], index) => (
                      <div className={`tool ${index < activeTool ? "complete" : index === activeTool ? "active" : ""}`} key={name}>
                        <span className="tool-state">{index < activeTool ? "✓" : index === activeTool ? "↻" : "·"}</span>
                        <code>{name}()</code><b>{index <= activeTool ? result : "Waiting"}</b><small>{index <= activeTool ? note : ""}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="panel-heading"><div><span className="kicker">STEP 02 · RESEARCH COMPLETE</span><h2>Your evidence library.</h2></div><button className="text-button" onClick={() => setStage("profile")}>Edit learning goal</button></div>
                  <div className="insight-strip"><b>Recommended test: {resourceData.recommendation.name}</b><span>{resourceData.recommendation.reason} Dates, local availability and acceptance should be rechecked before booking.</span><a href={resourceData.recommendation.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a></div>

                  {agentError && <div className="integration-error" role="alert"><span>!</span><div><b>The planning layer did not answer.</b><p>{agentError} The verified catalog below is unaffected.</p></div></div>}

                  {agentResult && (
                    <section className={`agent-brief ${agentResult.source}`} aria-labelledby="agent-brief-title">
                      <div className="agent-brief-heading">
                        <div>
                          <span className="kicker">PLANNING LAYER</span>
                          <h3 id="agent-brief-title">What the agent concluded.</h3>
                        </div>
                        <span className={`source-badge ${agentResult.source}`}>
                          {agentResult.source === "gateway"
                            ? `TrueFoundry AI Gateway · ${agentResult.telemetry?.model ?? "model"}`
                            : "Deterministic planner · no model call"}
                        </span>
                      </div>
                      <p className="agent-briefing">{agentResult.synthesis.briefing}</p>
                      <p className="agent-rationale">{agentResult.synthesis.testRationale}</p>

                      {agentResult.synthesis.riskFlags.length > 0 && (
                        <div className="risk-flags">
                          {agentResult.synthesis.riskFlags.map((flag) => (
                            <div key={flag.title}><b>{flag.title}</b><p>{flag.detail}</p></div>
                          ))}
                        </div>
                      )}

                      <div className="phase-focus">
                        {agentResult.synthesis.focusByPhase.map((item) => (
                          <div key={item.phase}><span>{item.phase}</span><b>{item.emphasis}</b><small>{item.why}</small></div>
                        ))}
                      </div>

                      <div className="grounding-row">
                        <b>Grounded in {agentResult.grounding.kept.length} verified record{agentResult.grounding.kept.length === 1 ? "" : "s"}</b>
                        <div>{agentResult.grounding.kept.map((name) => <span key={name}>{name}</span>)}</div>
                        <small>{agentResult.note}</small>
                      </div>

                      <div className="governance-receipt" aria-label="Gateway governance receipt">
                        <div className="receipt-heading"><b>Gateway receipt</b><span>Learner {agentResult.learnerId} · pseudonymous</span></div>
                        <dl>
                          <div><dt>Model</dt><dd>{agentResult.source === "gateway" ? agentResult.telemetry?.model : "no model called"}</dd></div>
                          <div><dt>Latency</dt><dd>{agentResult.source === "gateway" ? `${agentResult.telemetry?.latencyMs} ms` : "—"}</dd></div>
                          <div><dt>Tokens</dt><dd>{agentResult.telemetry?.usage.totalTokens ?? 0}</dd></div>
                          <div><dt>Est. cost</dt><dd>${(agentResult.telemetry?.estimatedCostUsd ?? 0).toFixed(5)}</dd></div>
                          <div><dt>Fallbacks used</dt><dd>{Math.max(0, (agentResult.telemetry?.attempts.length ?? 1) - 1)}</dd></div>
                          <div><dt>Input guardrails</dt><dd>{agentResult.telemetry?.guardrails.input.length ? agentResult.telemetry.guardrails.input.join(", ") : "none configured"}</dd></div>
                          <div><dt>Daily budget left</dt><dd>{agentResult.budget.remainingCalls}/{agentResult.budget.ceilingCalls} calls</dd></div>
                          <div><dt>Dropped citations</dt><dd>{agentResult.grounding.dropped.length}</dd></div>
                        </dl>
                        {gatewayInfo && <p className="receipt-note">{gatewayInfo.gateway.configured ? `Tenant ${gatewayInfo.gateway.tenant} · cost centre ${gatewayInfo.gateway.costCenter} · ${gatewayInfo.gateway.host}` : gatewayInfo.degradedMode}</p>}
                      </div>
                    </section>
                  )}

                  <section className="resource-explorer" aria-labelledby="all-resources-title">
                    <div className="resource-heading">
                      <div><span className="kicker">AGENT RESEARCH · FULL RESULTS</span><h3 id="all-resources-title">See every recommendation.</h3></div>
                      <p>All {profile.language} research is grouped into five clearly separated sections below. Catalog checked {resourceData.lastVerified}; availability is always rechecked at the source.</p>
                    </div>

                    <section className="research-group" aria-labelledby="tests-centres-title">
                      <div className="research-section-heading">
                        <span className="section-index">01</span>
                        <div><h3 id="tests-centres-title">Tests &amp; centres</h3><p>Compare recognized exams and open current registration sources for {profile.city}, {profile.country}.</p></div>
                      </div>
                      <div className="research-section">
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
                      </div>
                    </section>

                    <section className="research-group" aria-labelledby="guidance-immersion-title">
                      <div className="research-section-heading">
                        <span className="section-index">02</span>
                        <div><h3 id="guidance-immersion-title">YouTube, forums &amp; TV shows</h3><p>Learn with 10 ranked educators, 3 learner communities, and 10 target-language shows.</p></div>
                      </div>
                      <div className="research-section">
                      <div className="result-subhead"><b>YouTube educators</b><span>{resourceData.youtube.length} ranked channels</span></div>
                      <div className="resource-list">
                        {resourceData.youtube.map((channel, index) => (
                          <a href={channel.url} target="_blank" rel="noreferrer" key={channel.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{channel.name}</b><p>{channel.bestFor}</p><small>{channel.level} · learner-fit score {channel.score}/100</small></div><span className="open-link">Watch ↗</span></a>
                        ))}
                      </div>
                      <div className="result-subhead secondary-head"><b>Study forums</b><span>{resourceData.forums?.length ?? 0} active communities</span></div>
                      <div className="resource-list forum-list">
                        {(resourceData.forums ?? []).map((forum, index) => (
                          <a href={forum.url} target="_blank" rel="noreferrer" key={forum.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{forum.name}</b><p>{forum.bestFor}</p><small>Active study community · verify community rules before posting</small></div><span className="open-link">Join ↗</span></a>
                        ))}
                      </div>
                      <div className="result-subhead secondary-head"><b>TV immersion watchlist</b><span>{resourceData.tvShows.length} shows in {profile.language}</span></div>
                      <div className="material-grid media-grid">
                        {resourceData.tvShows.map((show, index) => (
                          <a href={show.url} target="_blank" rel="noreferrer" key={show.name}><span className="material-number">{String(index + 1).padStart(2, "0")}</span><div><b>{show.name}</b><p>{show.genre} · {show.origin}</p><small>Suggested learner level {show.level} · check local streaming availability</small></div><span className="open-link">Show guide ↗</span></a>
                        ))}
                      </div>
                      </div>
                    </section>

                    <section className="research-group" aria-labelledby="four-skills-title">
                      <div className="research-section-heading">
                        <span className="section-index">03</span>
                        <div><h3 id="four-skills-title">Reading, speaking, listening &amp; writing</h3><p>Skill-specific materials keep every part of the study plan actionable and balanced.</p></div>
                      </div>
                      <div className="research-section">
                      {(["reading", "speaking", "listening", "writing"] as const).map((skill, skillIndex) => (
                        <div className={`skill-group ${skillIndex > 0 ? "secondary-head" : ""}`} key={skill}>
                          <div className="result-subhead"><b>{skill[0].toUpperCase() + skill.slice(1)}</b><span>{resourceData.materials[skill].length} curated materials</span></div>
                          <div className="material-grid">
                            {resourceData.materials[skill].map((material, index) => (
                              <a href={material.url} target="_blank" rel="noreferrer" key={material.name}><span className="material-number">{String(index + 1).padStart(2, "0")}</span><div><b>{material.name}</b><p>{material.use}</p><small>{material.cost} · {material.level}</small></div><span className="open-link">Open ↗</span></a>
                            ))}
                          </div>
                        </div>
                      ))}
                      </div>
                    </section>

                    <section className="research-group" aria-labelledby="textbooks-title">
                      <div className="research-section-heading">
                        <span className="section-index">04</span>
                        <div><h3 id="textbooks-title">Textbook recommendations</h3><p>Use 3 established coursebooks selected for the target language, level, and exam pathway.</p></div>
                      </div>
                      <div className="research-section">
                        <div className="result-subhead"><b>Structured coursebooks</b><span>{resourceData.textbooks.length} recommendations</span></div>
                        <div className="resource-list textbook-list">
                          {resourceData.textbooks.map((book, index) => (
                            <a href={book.url} target="_blank" rel="noreferrer" key={book.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{book.name}</b><p>{book.bestFor}</p><small>{book.authorPublisher} · {book.level}</small></div><span className="open-link">Book ↗</span></a>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section className="research-group" aria-labelledby="mock-exams-title">
                      <div className="research-section-heading">
                        <span className="section-index">05</span>
                        <div><h3 id="mock-exams-title">Mock exams</h3><p>Practice with 3 exam-specific platforms matched to the recommended certification path.</p></div>
                      </div>
                      <div className="research-section">
                      <div className="result-subhead"><b>Practice platforms</b><span>{resourceData.mockExams.length} current options</span></div>
                      <div className="resource-list tests-list mock-list">
                        {resourceData.mockExams.map((mock, index) => (
                          <a href={mock.url} target="_blank" rel="noreferrer" key={mock.name}><span className="rank">#{String(index + 1).padStart(2, "0")}</span><div><b>{mock.name}</b><p>{mock.access}</p><small>{mock.exam} · confirm current access terms at source</small></div><span className="open-link">Practice ↗</span></a>
                        ))}
                      </div>
                      </div>
                    </section>
                  </section>
                  <div className="page-actions"><button className="text-button" onClick={() => setStage("profile")}>← Learning goal</button><button className="primary compact" onClick={() => setStage("plans")}>Compare strategies →</button></div>
                </>
              )}
            </div>
          )}

          {stage === "plans" && resourceData && (
            <div className="plans-view">
              <div className="panel-heading"><div><span className="kicker">STEP 03 · CHOOSE A STRATEGY</span><h2>Three strategies. One honest time budget.</h2></div><button className="text-button" onClick={() => setStage("running")}>Review research</button></div>
              <div className="insight-strip"><b>{resourceData.recommendation.name} · {feasibility.weeklyHours} hours/week</b><span>Every strategy uses the verified {profile.language} research set and includes the deadline-feasibility assessment.</span></div>
              <div className="plan-grid">
                {plans.map((plan) => (
                  <button aria-pressed={selected === plan.id} className={`plan-card plan-${plan.id} ${selected === plan.id ? "selected" : ""}`} key={plan.id} onClick={() => setSelected(plan.id)}>
                    <span className={`swatch ${plan.accent.toLowerCase()}`} /><span className="plan-name">{plan.name}</span><span className="check">{selected === plan.id ? "✓" : ""}</span>
                    <strong>{plan.tagline}</strong><small>{feasibility.weeklyHours} hours/week · {plan.split}</small><p>{plan.outcome}</p>
                  </button>
                ))}
              </div>
              <div className="page-actions"><button className="text-button" onClick={() => setStage("running")}>← Agent research</button><button className="primary compact" onClick={() => { setUnlockedStage(3); setStage("exported"); }}>Use {selectedPlan.name} →</button></div>
            </div>
          )}

          {stage === "exported" && resourceData && (
            <div className="start-view">
              <div className="panel-heading"><div><span className="kicker">STEP 04 · START STUDYING</span><h2>Your study system is ready.</h2></div><button className="text-button" onClick={() => setStage("plans")}>Change strategy</button></div>
              <div className="start-summary"><span>{profile.language}</span><b>{selectedPlan.name}</b><small>{profile.dailyHours}h/day · {profile.studyDays} days/week · target {profile.date}</small></div>
              <div className="schedule">
                <div><span className="kicker">YOUR FIRST STUDY BLOCK</span><h3>{selectedPlan.name} · Week one</h3>{selectedPlan.sample.map((item) => <p key={item}><span>✓</span>{item}</p>)}</div>
                <div className="resource-stack"><span className="kicker">RESOURCES IN THIS PLAN</span>{featuredResources.map(([skill, name, meta]) => <div key={skill}><b>{skill}</b><span>{name}</span><small>{meta}</small></div>)}</div>
              </div>
              <section className="study-plan-section" aria-labelledby="study-plan-title">
                <div className="study-plan-heading"><div><span className="kicker">DATED STUDY PLAN</span><h3 id="study-plan-title">{studyPlan.length} focused sessions to your target</h3></div><p>Adapted from the workbook model: dated phases, daily focus, a coursebook, skill practice, duration, and a completion checkbox.</p></div>
                <div className="study-plan-scroll">
                  <table>
                    <thead><tr><th>Day</th><th>Date</th><th>Phase</th><th>Today&apos;s focus</th><th>Textbook</th><th>Practice</th><th>Done</th></tr></thead>
                    <tbody>
                      {studyPlan.map((row: StudyPlanRow) => (
                        <tr key={row.day} className={`phase-${row.phase.toLowerCase().replaceAll(" ", "-").replaceAll("&", "and")}`}>
                          <td>{row.day}</td><td>{row.dateLabel}</td><td>{row.phase}</td><td>{row.focus}</td><td>{row.textbook}</td><td>{row.practice}<small>{row.durationMinutes} min</small></td>
                          <td><input type="checkbox" aria-label={`Mark study day ${row.day} complete`} checked={completedDays.includes(row.day)} onChange={() => toggleStudyDay(row.day)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="mcp-lab" aria-labelledby="mcp-lab-title">
                <div className="mcp-heading">
                  <div><span className="kicker">PERSONAL INTEGRATIONS</span><h3 id="mcp-lab-title">Notion sync is coming later.</h3></div>
                  <p>Personal workspace connections need secure, per-learner authorization. This public demo keeps that future feature out of the learner flow and offers a calendar export that needs no account at all.</p>
                </div>
                <div className="mcp-empty">
                  <b>Bring your own workspace later.</b>
                  Use the universal <code>.ics</code> download above to add this plan to Google, Apple, or Outlook Calendar without connecting an account.
                </div>
              </section>

              <section className="writing-lab" aria-labelledby="writing-lab-title">
                <div className="writing-lab-heading">
                  <div><span className="kicker">WRITING FEEDBACK LOOP</span><h3 id="writing-lab-title">Get one piece of writing marked.</h3></div>
                  <p>
                    Paste a response to any writing task. Direct identifiers are stripped on this server before the request
                    leaves it, prompt logging stays off for this feature, and the marked reply is metered against a
                    per-learner budget at the TrueFoundry AI Gateway.
                  </p>
                </div>
                <form className="writing-form" onSubmit={requestWritingFeedback}>
                  <label className="wide">Task prompt (optional)<input value={writingPrompt} placeholder={`e.g. Some people think exams are the best way to assess learning. Discuss.`} onChange={(event) => setWritingPrompt(event.target.value)} /></label>
                  <label className="wide">Your writing<textarea rows={7} value={writingSample} placeholder={`Paste at least 40 words of your ${profile.language} writing.`} onChange={(event) => setWritingSample(event.target.value)} /></label>
                  <div className="writing-actions">
                    <small>{writingSample.split(/\s+/).filter(Boolean).length} words · {gatewayInfo?.gateway.configured ? "gateway connected" : "gateway offline — structural check only"}</small>
                    <button className="primary compact" data-testid="request-feedback" disabled={writingStatus === "marking"}>{writingStatus === "marking" ? "Marking…" : "Mark my writing →"}</button>
                  </div>
                </form>
                {writingStatus === "error" && <div className="integration-error" role="alert"><span>!</span><div><b>The sample was not marked.</b><p>{writingMessage}</p></div></div>}
                {writingResult && (
                  <div className="writing-result" aria-live="polite">
                    <div className="writing-result-heading">
                      <div>
                        <b>{writingResult.feedback.scored ? `Estimated ${writingResult.exam} level: ${writingResult.feedback.bandEstimate}` : "Structural check"}</b>
                        <small>{writingResult.wordCount} words · {writingResult.feedback.scored ? "estimate only, not an official result" : "no model was called"}</small>
                      </div>
                      <span className={`source-badge ${writingResult.source === "gateway" ? "gateway" : "deterministic"}`}>
                        {writingResult.source === "gateway" ? `Gateway · ${writingResult.telemetry?.model ?? "model"}` : "Offline heuristics"}
                      </span>
                    </div>
                    <p className="writing-summary">{writingResult.feedback.summary}</p>
                    {writingResult.feedback.strengths.length > 0 && (
                      <ul className="writing-strengths">{writingResult.feedback.strengths.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul>
                    )}
                    <div className="writing-fixes">
                      {writingResult.feedback.fixes.map((fix, index) => (
                        <div key={fix.issue}>
                          <span className="fix-index">{String(index + 1).padStart(2, "0")}</span>
                          <div><b>{fix.issue}</b>{fix.excerpt && <blockquote>{fix.excerpt}</blockquote>}<p>{fix.rewrite}</p></div>
                        </div>
                      ))}
                    </div>
                    <p className="writing-next"><b>Next task:</b> {writingResult.feedback.nextTask}</p>
                    <div className="writing-receipt">
                      <span>{writingResult.note}</span>
                      <span>{writingResult.redactions.length > 0 ? writingResult.redactions.map((item) => `${item.count} ${item.type}`).join(" · ") : "no identifiers found"}</span>
                      <span>{writingResult.telemetry ? `${writingResult.telemetry.usage.totalTokens} tokens · ${writingResult.telemetry.latencyMs} ms · $${writingResult.telemetry.estimatedCostUsd.toFixed(5)}` : "no gateway call"}</span>
                      <span>Prompt logging {writingResult.telemetry?.promptLogging ? "on" : "off"} · {writingResult.budget.remainingCalls}/{writingResult.budget.ceilingCalls} daily calls left</span>
                    </div>
                  </div>
                )}
              </section>
              <div className="export-row">
                <div><b>Universal calendar</b><span>Not brokered, because it needs nothing to broker: the .ics is built in your browser and imports into Google, Apple, or Outlook with no account and no OAuth.</span></div>
                {googleCalendarUrl && <a className="secondary action-link" href={googleCalendarUrl} target="_blank" rel="noreferrer">Open Google Calendar ↗</a>}
                <button className="primary compact" data-testid="download-ics" onClick={downloadIcs}>Download universal .ICS ↓</button>
              </div>
              {calendarReady && <div className="success" role="status"><span>✓</span><div><b>Calendar file generated with 15 events.</b><p>Import it into Google, Apple, or Outlook Calendar. Events use {profile.timezone} and reminders repeat through {profile.date}.</p></div></div>}
              <div className="page-actions"><button className="text-button" onClick={() => setStage("plans")}>← Choose a strategy</button><button className="primary compact" onClick={() => { setUnlockedStage(4); setStage("progress"); }}>Track progress →</button></div>
            </div>
          )}

          {stage === "progress" && resourceData && (
            <div className="progress-view">
              <div className="panel-heading"><div><span className="kicker">STEP 05 · TRACK PROGRESS</span><h2>See the work adding up.</h2></div><button className="text-button" onClick={() => setStage("exported")}>Open study plan</button></div>
              <div className="progress-kpis">
                <div><span>Completion</span><b>{completionPercent}%</b><small>{completedDays.length} of {studyPlan.length} sessions</small></div>
                <div><span>Focused time</span><b>{Math.round(completedDays.length * profile.dailyHours * 10) / 10}h</b><small>{feasibility.neededHours}h estimated path</small></div>
                <div><span>Remaining</span><b>{studyPlan.length - completedDays.length}</b><small>scheduled sessions</small></div>
              </div>
              <section className="progress-panel" aria-labelledby="progress-chart-title">
                <div className="progress-panel-heading">
                  <div><span className="kicker">COMPLETION STATISTICS</span><h3 id="progress-chart-title">{progressView[0].toUpperCase() + progressView.slice(1)} progress</h3></div>
                  <div className="progress-switcher" role="group" aria-label="Progress chart period">
                    {(["daily", "weekly", "monthly"] as const).map((view) => <button className={progressView === view ? "active" : ""} aria-pressed={progressView === view} onClick={() => setProgressView(view)} key={view}>{view}</button>)}
                  </div>
                </div>
                <div className="progress-chart" aria-label={`${progressView} completion chart`}>
                  {progressSeries.map((point) => (
                    <div className="chart-column" key={point.key}>
                      <span className="chart-value">{point.percent}%</span>
                      <div className="chart-track"><span style={{ height: `${Math.max(3, point.percent)}%` }} /></div>
                      <small>{point.label}</small>
                    </div>
                  ))}
                </div>
                <p className="chart-note">Check sessions on the study-plan page, or read the ticked boxes back from the Notion plan page through the MCP Gateway.</p>
              </section>
              <div className="progress-sync">
                <div><b>Notion progress sync</b><span>{notionPlanRef ? "Reads the ticked sessions back through notion/notion-fetch. The same brokered path as the write — still no Notion token here." : "Run the study-plan action on the Start studying page first, so there is a page to read."}</span></div>
                <button className="secondary" data-testid="sync-progress" disabled={!notionPlanRef || progressSyncStatus === "syncing"} onClick={syncNotionProgress}>{progressSyncStatus === "syncing" ? "Reading…" : "Sync from Notion ↻"}</button>
              </div>
              {progressSyncMessage && <div className={progressSyncStatus === "error" ? "integration-error" : "success"} role="status"><span>{progressSyncStatus === "error" ? "!" : "✓"}</span><div><b>{progressSyncStatus === "error" ? "Progress sync needs attention." : "Progress synced."}</b><p>{progressSyncMessage}</p></div></div>}
              <div className="page-actions"><button className="text-button" onClick={() => setStage("exported")}>← Start studying</button></div>
            </div>
          )}
        </div>
      </section>

      <section className="evidence">
        <span className="kicker">WHY THIS IS AN AGENT, NOT A PROMPT</span>
        <div><h2>Research first.<br />Plan second.<br /><em>Learn for real.</em></h2><p>Sologurus is a planning agent that brings no models and no integration secrets of its own. It connects to your TrueFoundry account and uses whatever you have put there: your models, your MCP servers, your guardrails, your budgets. Every call carries a pseudonymous learner id and returns a receipt, so the schedule cites a real resource, obeys your hours, and can be audited by the institution running it.</p></div>
        <div className="schema-card"><code>{`plan = {\n  strategy: "balanced",\n  weekly_minutes: 480,\n  resources: Resource[],\n  constraint_check: "passed",\n  gateway: "truefoundry",\n  citations: "catalog-verified"\n}`}</code></div>
      </section>
      <footer><span>Sologurus · bring your own TrueFoundry</span><span>Built for self-directed learners.</span></footer>
    </main>
  );
}
