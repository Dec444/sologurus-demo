"use client";

import { useEffect, useMemo, useState } from "react";
import languages from "../data/languages.json";
import locations from "../data/locations.json";
import { makeCalendarIcs } from "../lib/calendar.mjs";
import { assessFeasibility, buildProgressSeries, buildStudyPlan, type StudyPlanRow } from "../lib/learning-plan.mjs";

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
  const [notionStatus, setNotionStatus] = useState<"idle" | "connecting" | "success" | "error">("idle");
  const [notionMessage, setNotionMessage] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [notionApiConfigured, setNotionApiConfigured] = useState(false);
  const [calendarReady, setCalendarReady] = useState(false);
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [notionPlanPageId, setNotionPlanPageId] = useState("");
  const [progressView, setProgressView] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [completedDays, setCompletedDays] = useState<number[]>([]);
  const [progressSyncStatus, setProgressSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [progressSyncMessage, setProgressSyncMessage] = useState("");
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
    ["generate_plans", `3 strategies · ${feasibility.weeklyHours} h/week`, feasibility.status === "not-practical" ? "Timeline warning included" : "Constraint check passed"],
  ], [feasibility.status, feasibility.weeklyHours, profile.city, profile.country, profile.language, resourceData]);

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
    setCompletedDays([]);
    setNotionPlanPageId("");
    setStage("running");
    setUnlockedStage((current) => Math.max(current, 1));
    setResearchRunning(true);
    setActiveTool(0);
    for (let index = 0; index < toolSteps.length; index += 1) {
      setActiveTool(index);
      await new Promise((resolve) => setTimeout(resolve, 520));
    }
    setResearchRunning(false);
    setUnlockedStage((current) => Math.max(current, 2));
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

  const connectNotion = async () => {
    setNotionStatus("connecting");
    setNotionMessage("");
    setNotionUrl("");
    try {
      const response = await fetch("/api/notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: { ...profile, hours: feasibility.weeklyHours }, feasibility, plan: selectedPlan, resources: resourceData, studyPlan }),
      });
      const result = await response.json() as { ok?: boolean; url?: string; planPageId?: string; planUrl?: string; message?: string };
      if (!response.ok || !result.ok || !result.url) throw new Error(result.message || "Notion page creation failed.");
      setNotionUrl(result.url);
      setNotionPlanPageId(result.planPageId ?? "");
      setNotionMessage(`The main page and its ${studyPlan.length}-session study-plan subpage now match this learner.`);
      setNotionStatus("success");
    } catch (error) {
      setNotionStatus("error");
      setNotionMessage(error instanceof Error ? error.message : "Notion page creation failed.");
    }
  };

  const toggleStudyDay = (day: number) => {
    setCompletedDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort((a, b) => a - b));
  };

  const syncNotionProgress = async () => {
    if (!notionPlanPageId) return;
    setProgressSyncStatus("syncing");
    setProgressSyncMessage("");
    try {
      const response = await fetch("/api/notion", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planPageId: notionPlanPageId }),
      });
      const result = await response.json() as { ok?: boolean; completedDays?: number[]; message?: string };
      if (!response.ok || !result.ok || !result.completedDays) throw new Error(result.message || "Could not sync Notion progress.");
      setCompletedDays(result.completedDays);
      setProgressSyncStatus("success");
      setProgressSyncMessage(`Synced ${result.completedDays.length} completed sessions from the Notion study-plan subpage.`);
    } catch (error) {
      setProgressSyncStatus("error");
      setProgressSyncMessage(error instanceof Error ? error.message : "Could not sync Notion progress.");
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
          <a className={`account-link ${notionApiConfigured ? "connected" : ""}`} href={notionApiConfigured ? "https://www.notion.so/" : "https://www.notion.so/profile/integrations"} target="_blank" rel="noreferrer"><span className="account-dot" /> <span><b>Notion</b><small>{notionApiConfigured ? "Connected" : "Sign in"}</small></span></a>
          <a className={`account-link ${googleCalendarUrl ? "connected" : ""}`} href={googleCalendarUrl || "https://calendar.google.com/calendar/u/0/r"} target="_blank" rel="noreferrer"><span className="account-dot" /> <span><b>Google</b><small>{googleCalendarUrl ? "Connected" : "Sign in"}</small></span></a>
          <button className="community-toggle" aria-expanded={communityOpen} aria-controls="community-finder" onClick={toggleCommunity}>Community <span>{communityOpen ? "×" : "↘"}</span></button>
        </nav>
      </header>

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
        <p>Sologurus turns a language-test goal into verified options, credible resources, and a calendar-ready study plan — without a tutor or subscription.</p>
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
          <li><span>✓</span>A study calendar built around your real time</li>
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
                  <span className="kicker">STEP 02 · GPT-5.6 ORCHESTRATION</span>
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
              ) : (
                <>
                  <div className="panel-heading"><div><span className="kicker">STEP 02 · RESEARCH COMPLETE</span><h2>Your evidence library.</h2></div><button className="text-button" onClick={() => setStage("profile")}>Edit learning goal</button></div>
                  <div className="insight-strip"><b>Recommended test: {resourceData.recommendation.name}</b><span>{resourceData.recommendation.reason} Dates, local availability and acceptance should be rechecked before booking.</span><a href={resourceData.recommendation.sourceUrl} target="_blank" rel="noreferrer">Official source ↗</a></div>

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
              <div className="export-row">
                <div><b>Send the plan somewhere real.</b><span>Notion receives the overview plus this dated plan as a child subpage. Calendar export remains universal.</span></div>
                <button className="secondary" data-testid="connect-notion" disabled={notionStatus === "connecting"} onClick={connectNotion}>{notionStatus === "connecting" ? "Updating Notion…" : notionApiConfigured ? "Update Notion + subpage ↗" : "Connect Notion to update ↗"}</button>
                {googleCalendarUrl && <a className="secondary action-link" href={googleCalendarUrl} target="_blank" rel="noreferrer">Open Google Calendar ↗</a>}
                <button className="primary compact" data-testid="download-ics" onClick={downloadIcs}>Download universal .ICS ↓</button>
              </div>
              {notionStatus === "error" && <div className="integration-error" role="alert"><span>!</span><div><b>Notion needs a write connection.</b><p>{notionMessage}</p></div></div>}
              {notionStatus === "success" && <div className="success" role="status"><span>✓</span><div><b>Notion matches this plan.</b><p>{notionMessage} <a href={notionUrl} target="_blank" rel="noreferrer">Open updated page ↗</a></p></div></div>}
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
                <p className="chart-note">Check sessions on the study-plan page, or sync completed checkboxes from the connected Notion subpage.</p>
              </section>
              <div className="progress-sync">
                <div><b>Notion progress sync</b><span>{notionPlanPageId ? "Read completed checkboxes from the generated study-plan subpage." : "Update Notion from the Start studying page to create and connect the subpage."}</span></div>
                <button className="secondary" disabled={!notionPlanPageId || progressSyncStatus === "syncing"} onClick={syncNotionProgress}>{progressSyncStatus === "syncing" ? "Syncing…" : "Sync Notion progress ↻"}</button>
              </div>
              {progressSyncMessage && <div className={progressSyncStatus === "error" ? "integration-error" : "success"} role="status"><span>{progressSyncStatus === "error" ? "!" : "✓"}</span><div><b>{progressSyncStatus === "error" ? "Progress sync needs attention." : "Progress synced."}</b><p>{progressSyncMessage}</p></div></div>}
              <div className="page-actions"><button className="text-button" onClick={() => setStage("exported")}>← Start studying</button></div>
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
