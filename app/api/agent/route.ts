import { buildResourceCatalog, catalogDigest, citableSourceNames, type ResourceCatalog } from "../../../lib/study/catalog";
import { gatewayChat, parseJsonContent, readGatewayConfig } from "../../../lib/truefoundry/gateway.mjs";
import type { GatewayTelemetry } from "../../../lib/truefoundry/gateway";
import {
  buildRequestMetadata,
  evaluateBudget,
  findFeature,
  keepGroundedCitations,
  pseudonymousLearnerId,
  recordUsage,
} from "../../../lib/truefoundry/governance.mjs";

const FEATURE_ID = "research-synthesis";
const PHASES = ["Foundation", "Skill building", "Exam technique", "Mock & taper"] as const;

type AgentProfile = {
  language?: string;
  level?: string;
  city?: string;
  country?: string;
  goal?: string;
  date?: string;
  dailyHours?: number;
  studyDays?: number;
  consistency?: string;
  examExperience?: string;
};

type AgentFeasibility = {
  status?: string;
  title?: string;
  advice?: string;
  availableHours?: number;
  neededHours?: number;
  weeklyHours?: number;
  currentLevel?: string;
  targetLevel?: string;
};

type Synthesis = {
  briefing: string;
  testRationale: string;
  riskFlags: Array<{ title: string; detail: string }>;
  focusByPhase: Array<{ phase: string; emphasis: string; why: string }>;
  citations: string[];
};

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/**
 * The synthesis Sologurus shows when the gateway is unconfigured, over budget,
 * or unreachable. It is derived from the same feasibility maths and the same
 * catalog, so the product never degrades into an error state.
 */
function deterministicSynthesis(profile: AgentProfile, feasibility: AgentFeasibility, resources: ResourceCatalog): Synthesis {
  const language = resources.language;
  const test = resources.recommendation.name;
  const weekly = feasibility.weeklyHours ?? 0;
  const riskFlags: Array<{ title: string; detail: string }> = [];

  if (feasibility.status === "not-practical") {
    riskFlags.push({ title: "The deadline does not fit the hours", detail: String(feasibility.advice ?? "") });
  } else if (feasibility.status === "tight") {
    riskFlags.push({ title: "The timeline has no slack", detail: String(feasibility.advice ?? "") });
  }
  if (profile.consistency === "starting") {
    riskFlags.push({
      title: "The habit is still forming",
      detail: `Protect the first three weeks: a shorter session that happens beats a ${profile.dailyHours}-hour session that does not.`,
    });
  }
  if (profile.examExperience === "first") {
    riskFlags.push({
      title: "First time with this exam format",
      detail: `Sit one full timed ${test} mock early, so the format costs you nothing on test day.`,
    });
  }

  return {
    briefing: `${language} at ${profile.level} with ${weekly} hours a week against ${profile.goal}. `
      + `The catalog below was checked ${resources.lastVerified}, and the plan is built only from those records.`,
    testRationale: `${test} — ${resources.recommendation.reason} `
      + (resources.centerMode === "official-directory"
        ? `No verified centre record exists for ${profile.city}, so Sologurus links the official directory rather than inventing a venue.`
        : `Verified centre records exist for ${profile.city}, shown alongside the official directory.`),
    riskFlags: riskFlags.slice(0, 3),
    focusByPhase: [
      { phase: "Foundation", emphasis: "High-frequency vocabulary and core grammar", why: "Everything later is cheaper once retrieval is fast." },
      { phase: "Skill building", emphasis: "Balanced four-skill practice with an error log", why: "Named mistake patterns are what actually shift a band score." },
      { phase: "Exam technique", emphasis: `Timed ${test} task types`, why: "Method and pacing are separate skills from language ability." },
      { phase: "Mock & taper", emphasis: "Full mocks, then deliberate rest", why: "Late cramming costs more than it returns." },
    ],
    citations: [
      resources.textbooks[0]?.name,
      resources.mockExams[0]?.name,
      resources.youtube[0]?.name,
    ].filter((name): name is string => Boolean(name)),
  };
}

function normalizeSynthesis(raw: Record<string, unknown> | null, fallback: Synthesis): Synthesis {
  if (!raw) return fallback;
  const riskFlags = Array.isArray(raw.riskFlags)
    ? raw.riskFlags
      .map((flag) => ({
        title: text((flag as Record<string, unknown>)?.title, 90),
        detail: text((flag as Record<string, unknown>)?.detail, 260),
      }))
      .filter((flag) => flag.title && flag.detail)
      .slice(0, 3)
    : [];
  const focusByPhase = PHASES.map((phase) => {
    const match = Array.isArray(raw.focusByPhase)
      ? (raw.focusByPhase as Array<Record<string, unknown>>).find((item) => text(item?.phase, 40).toLocaleLowerCase() === phase.toLocaleLowerCase())
      : undefined;
    const fallbackPhase = fallback.focusByPhase.find((item) => item.phase === phase);
    return {
      phase,
      emphasis: text(match?.emphasis, 110) || (fallbackPhase?.emphasis ?? ""),
      why: text(match?.why, 220) || (fallbackPhase?.why ?? ""),
    };
  });

  return {
    briefing: text(raw.briefing, 600) || fallback.briefing,
    testRationale: text(raw.testRationale, 600) || fallback.testRationale,
    riskFlags: riskFlags.length > 0 ? riskFlags : fallback.riskFlags,
    focusByPhase,
    citations: Array.isArray(raw.citations) ? raw.citations.map((item) => text(item, 120)) : [],
  };
}

function buildMessages(profile: AgentProfile, feasibility: AgentFeasibility, resources: ResourceCatalog) {
  const system = [
    "You are the planning layer of Sologurus, a self-directed language-study agent used in an education setting.",
    "You reason only over the catalog supplied in the user message. You never introduce a resource, textbook, exam, channel or test centre that is not in it.",
    "You never state an exam date, a price, or a physical address: those change, and the product links the official directory instead.",
    "You address the learner directly, in plain language, without motivational filler.",
    "Reply with a single JSON object and nothing else, using exactly these keys:",
    '{"briefing": string, "testRationale": string, "riskFlags": [{"title": string, "detail": string}], "focusByPhase": [{"phase": string, "emphasis": string, "why": string}], "citations": [string]}',
    `focusByPhase must contain exactly these four phases, in order: ${PHASES.join(", ")}.`,
    "riskFlags holds at most three genuine risks to this learner's timeline; return an empty array when the plan is sound.",
    "citations lists the exact catalog names you relied on. A name that is not in the catalog will be discarded.",
  ].join("\n");

  const user = JSON.stringify({
    learner: {
      targetLanguage: profile.language,
      currentLevel: profile.level,
      goal: profile.goal,
      targetDate: profile.date,
      location: `${profile.city}, ${profile.country}`,
      hoursPerStudyDay: profile.dailyHours,
      studyDaysPerWeek: profile.studyDays,
      recentConsistency: profile.consistency,
      examExperience: profile.examExperience,
    },
    feasibility: {
      status: feasibility.status,
      effectiveHours: feasibility.availableHours,
      estimatedHoursNeeded: feasibility.neededHours,
      weeklyHours: feasibility.weeklyHours,
      currentLevel: feasibility.currentLevel,
      targetLevel: feasibility.targetLevel,
    },
    catalog: catalogDigest(resources),
  });

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export async function POST(request: Request) {
  let body: { profile?: AgentProfile; feasibility?: AgentFeasibility };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Send a JSON body containing profile and feasibility." }, { status: 400 });
  }

  const profile = body.profile ?? {};
  const feasibility = body.feasibility ?? {};
  const feature = findFeature(FEATURE_ID);
  if (!feature) return Response.json({ ok: false, message: "Unknown AI feature." }, { status: 500 });

  const resources = buildResourceCatalog(
    String(profile.language ?? "English"),
    String(profile.city ?? "your city"),
    String(profile.country ?? "your country"),
  );
  const fallback = deterministicSynthesis(profile, feasibility, resources);
  const config = readGatewayConfig();
  const learnerId = pseudonymousLearnerId(profile);
  const budget = evaluateBudget(learnerId, feature);

  const respond = (
    source: "gateway" | "deterministic",
    synthesis: Synthesis,
    telemetry: GatewayTelemetry | null,
    note: string,
    grounding: { kept: string[]; dropped: string[] },
  ) => Response.json(
    {
      ok: true,
      source,
      note,
      learnerId,
      synthesis: { ...synthesis, citations: grounding.kept },
      grounding,
      telemetry,
      budget: evaluateBudget(learnerId, feature),
      catalogVerified: resources.lastVerified,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );

  if (!budget.allowed) {
    return respond("deterministic", fallback, null, budget.reason, keepGroundedCitations(fallback.citations, citableSourceNames(resources)));
  }

  const result = await gatewayChat({
    config,
    feature: feature.id,
    messages: buildMessages(profile, feasibility, resources),
    metadata: buildRequestMetadata({ config, feature, learnerId, language: resources.language, strategy: "" }),
    temperature: 0.2,
    maxTokens: feature.maxOutputTokens,
    jsonOnly: true,
    logPrompts: feature.promptLogging,
  });

  const allowedNames = citableSourceNames(resources);

  if (!result.ok) {
    const note = result.reason === "gateway-not-configured"
      ? "TrueFoundry AI Gateway credentials are not configured, so this synthesis came from the deterministic planner."
      : `The gateway did not return a synthesis (${result.reason}); the deterministic planner answered instead.`;
    return respond("deterministic", fallback, result.telemetry, note, keepGroundedCitations(fallback.citations, allowedNames));
  }

  recordUsage(learnerId, feature.id, result.telemetry);
  const synthesis = normalizeSynthesis(parseJsonContent(result.content), fallback);
  const grounding = keepGroundedCitations(synthesis.citations, allowedNames);
  const note = grounding.dropped.length > 0
    ? `${grounding.dropped.length} model citation(s) were not in the verified catalog and were dropped.`
    : "Every model citation resolved to a verified catalog record.";

  return respond("gateway", synthesis, result.telemetry, note, grounding);
}
