import { buildResourceCatalog } from "../../../lib/catalog";
import { gatewayChat, parseJsonContent, readGatewayConfig } from "../../../lib/truefoundry.mjs";
import type { GatewayTelemetry } from "../../../lib/truefoundry";
import {
  buildRequestMetadata,
  evaluateBudget,
  findFeature,
  pseudonymousLearnerId,
  recordUsage,
  redactPersonalData,
} from "../../../lib/governance.mjs";

const FEATURE_ID = "writing-feedback";
const MIN_WORDS = 40;
const MAX_CHARACTERS = 6000;

type FeedbackProfile = { language?: string; level?: string; goal?: string; city?: string; country?: string };

type Fix = { issue: string; excerpt: string; rewrite: string };

type Feedback = {
  scored: boolean;
  bandEstimate: string;
  summary: string;
  strengths: string[];
  fixes: Fix[];
  nextTask: string;
};

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const stringList = (value: unknown, max: number, limit: number) =>
  (Array.isArray(value) ? value : []).map((item) => text(item, max)).filter(Boolean).slice(0, limit);

/**
 * Offline check used when no gateway is configured, the budget is spent, or the
 * models are unreachable. It reports measurable structure only and never claims
 * a band score, because a score without a marker behind it would be a fiction.
 */
function heuristicFeedback(sample: string, exam: string): Feedback {
  const words = sample.split(/\s+/).filter(Boolean);
  const sentences = sample.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
  const averageSentence = sentences.length > 0 ? Math.round(words.length / sentences.length) : 0;
  const uniqueRatio = words.length > 0 ? Math.round((new Set(words.map((word) => word.toLocaleLowerCase())).size / words.length) * 100) : 0;
  const connectives = ["however", "therefore", "although", "whereas", "furthermore", "in contrast", "as a result"];
  const usedConnectives = connectives.filter((word) => sample.toLocaleLowerCase().includes(word));

  const strengths: string[] = [];
  if (words.length >= 250) strengths.push(`${words.length} words — enough length for a full ${exam} response.`);
  if (uniqueRatio >= 55) strengths.push(`${uniqueRatio}% distinct vocabulary, so the writing is not repeating itself.`);
  if (usedConnectives.length >= 3) strengths.push(`${usedConnectives.length} discourse markers found, which helps the examiner follow the argument.`);
  if (strengths.length === 0) strengths.push(`${words.length} words submitted and parsed. Structural checks are below.`);

  const fixes: Fix[] = [];
  if (words.length < 250) {
    fixes.push({
      issue: "Below the usual length for a full exam response",
      excerpt: `${words.length} words`,
      rewrite: `Most ${exam} writing tasks expect 250 words or more. Add one developed body paragraph with a concrete example.`,
    });
  }
  if (averageSentence > 28) {
    fixes.push({
      issue: "Sentences are long enough to lose the reader",
      excerpt: `${averageSentence} words per sentence on average`,
      rewrite: "Split the longest sentences. Aim for a 15–22 word average with deliberate variation.",
    });
  }
  if (usedConnectives.length < 2) {
    fixes.push({
      issue: "Few explicit links between ideas",
      excerpt: `${usedConnectives.length} discourse marker(s) found`,
      rewrite: "Signal the relationship between paragraphs — however, as a result, in contrast — rather than leaving it implied.",
    });
  }
  if (fixes.length === 0) {
    fixes.push({
      issue: "Structure passes the offline checks",
      excerpt: `${words.length} words · ${averageSentence} words per sentence · ${uniqueRatio}% distinct vocabulary`,
      rewrite: "Connect the TrueFoundry AI Gateway for a marked response against the exam rubric.",
    });
  }

  return {
    scored: false,
    bandEstimate: "",
    summary: `Offline structural check only — no model was called, so this is not a marked ${exam} response. `
      + `${words.length} words · ${sentences.length} sentences · ${averageSentence} words per sentence · ${uniqueRatio}% distinct vocabulary.`,
    strengths,
    fixes: fixes.slice(0, 3),
    nextTask: `Write one more response on the same prompt, applying the fixes above, then compare the two side by side.`,
  };
}

function normalizeFeedback(raw: Record<string, unknown> | null, fallback: Feedback): Feedback {
  if (!raw) return fallback;
  const fixes = (Array.isArray(raw.fixes) ? raw.fixes : [])
    .map((item) => {
      const fix = item as Record<string, unknown>;
      return { issue: text(fix?.issue, 110), excerpt: text(fix?.excerpt, 200), rewrite: text(fix?.rewrite, 300) };
    })
    .filter((fix) => fix.issue && fix.rewrite)
    .slice(0, 4);
  const summary = text(raw.summary, 700);
  if (!summary || fixes.length === 0) return fallback;

  return {
    scored: true,
    bandEstimate: text(raw.bandEstimate, 60),
    summary,
    strengths: stringList(raw.strengths, 200, 4),
    fixes,
    nextTask: text(raw.nextTask, 300) || fallback.nextTask,
  };
}

export async function POST(request: Request) {
  let body: { profile?: FeedbackProfile; sample?: string; prompt?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "Send a JSON body containing profile and sample." }, { status: 400 });
  }

  const profile = body.profile ?? {};
  const rawSample = String(body.sample ?? "").slice(0, MAX_CHARACTERS);
  const taskPrompt = text(body.prompt, 300);

  // Redact before anything leaves the server. The gateway PII guardrail is a
  // second, independent layer — neither one is trusted to be the only one. Every
  // count reported back is taken from the redacted text, so the learner sees the
  // same sample the marker did.
  const { text: sample, redactions } = redactPersonalData(rawSample);
  const wordCount = sample.split(/\s+/).filter(Boolean).length;

  if (wordCount < MIN_WORDS) {
    return Response.json(
      { ok: false, message: `Paste at least ${MIN_WORDS} words so the rubric has something to mark. Received ${wordCount}.` },
      { status: 400 },
    );
  }

  const feature = findFeature(FEATURE_ID);
  if (!feature) return Response.json({ ok: false, message: "Unknown AI feature." }, { status: 500 });

  const resources = buildResourceCatalog(
    String(profile.language ?? "English"),
    String(profile.city ?? "your city"),
    String(profile.country ?? "your country"),
  );
  const exam = resources.recommendation.name;
  const fallback = heuristicFeedback(sample, exam);
  const config = readGatewayConfig();
  const learnerId = pseudonymousLearnerId(profile);
  const budget = evaluateBudget(learnerId, feature);

  const respond = (source: "gateway" | "offline", feedback: Feedback, telemetry: GatewayTelemetry | null, note: string) =>
    Response.json(
      {
        ok: true,
        source,
        note,
        exam,
        wordCount,
        redactions,
        feedback,
        telemetry,
        budget: evaluateBudget(learnerId, feature),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );

  if (!budget.allowed) return respond("offline", fallback, null, budget.reason);

  const system = [
    `You are an experienced ${resources.language} writing examiner giving feedback for the ${exam}.`,
    `The learner is at ${profile.level ?? "an intermediate level"} and is working towards: ${profile.goal ?? "a general proficiency goal"}.`,
    "Mark only what is in the sample. Do not invent content the learner did not write.",
    "Quote the learner's own words in each excerpt, verbatim and short.",
    "Give a band or level estimate as a range, and say plainly that it is an estimate, not an official result.",
    "Reply with a single JSON object and nothing else:",
    '{"bandEstimate": string, "summary": string, "strengths": [string], "fixes": [{"issue": string, "excerpt": string, "rewrite": string}], "nextTask": string}',
    "Return two to four fixes, ordered by how much each one would move the score.",
  ].join("\n");

  const user = [
    taskPrompt ? `Task prompt: ${taskPrompt}` : "Task prompt: not supplied; mark the sample on its own terms.",
    "",
    "Learner sample:",
    sample,
  ].join("\n");

  const result = await gatewayChat({
    config,
    feature: feature.id,
    messages: [{ role: "system", content: system }, { role: "user", content: user }],
    metadata: buildRequestMetadata({ config, feature, learnerId, language: resources.language, strategy: "" }),
    temperature: 0.3,
    maxTokens: feature.maxOutputTokens,
    jsonOnly: true,
    logPrompts: feature.promptLogging,
  });

  if (!result.ok) {
    const note = result.reason === "gateway-not-configured"
      ? "TrueFoundry AI Gateway credentials are not configured, so this is a structural check rather than marked feedback."
      : `The gateway could not mark this sample (${result.reason}); the offline structural check ran instead.`;
    return respond("offline", fallback, result.telemetry, note);
  }

  recordUsage(learnerId, feature.id, result.telemetry);
  const feedback = normalizeFeedback(parseJsonContent(result.content), fallback);
  const note = redactions.length > 0
    ? `Marked through the gateway. ${redactions.map((item) => `${item.count} ${item.type}`).join(", ")} redacted before the request left this server.`
    : "Marked through the gateway. No direct identifiers were found in the sample.";

  return respond(feedback.scored ? "gateway" : "offline", feedback, result.telemetry, feedback.scored ? note : "The model reply did not match the rubric schema, so the offline structural check was used.");
}
