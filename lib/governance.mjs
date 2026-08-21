/**
 * AI governance policy for Sologurus.
 *
 * TrueFoundry enforces budgets, rate limits and guardrails centrally at the
 * gateway. This module is the application-side half of the same contract: it
 * decides what may be sent, strips learner identity before it leaves the
 * server, tags every request for cost attribution, and keeps a local mirror of
 * the spend so the learner can see the budget they are working inside.
 *
 * The local ledger is per-runtime and resets with the isolate. It exists to
 * make the policy visible, not to be the enforcement point — the gateway rule
 * keyed on the same metadata is what actually blocks a request.
 */

/** Features allowed to reach a model, and the ceiling each one runs under. */
export const AI_FEATURES = [
  {
    id: "research-synthesis",
    label: "Research synthesis",
    purpose: "Explain why the curated evidence fits this learner, grounded in the catalog.",
    maxOutputTokens: 900,
    dailyCallCeiling: 40,
    dailyTokenCeiling: 60_000,
    sendsLearnerProse: false,
    promptLogging: true,
  },
  {
    id: "writing-feedback",
    label: "Writing feedback",
    purpose: "Score a learner writing sample against the target exam rubric.",
    maxOutputTokens: 1200,
    dailyCallCeiling: 20,
    dailyTokenCeiling: 40_000,
    sendsLearnerProse: true,
    promptLogging: false,
  },
  {
    id: "governed-actions",
    label: "Governed actions",
    purpose: "Write the plan into Notion or a calendar through MCP tools the skills registry permits.",
    maxOutputTokens: 0,
    dailyCallCeiling: 30,
    dailyTokenCeiling: 0,
    sendsLearnerProse: false,
    promptLogging: true,
  },
];

export function findFeature(featureId) {
  return AI_FEATURES.find((feature) => feature.id === featureId) ?? null;
}

/**
 * Stable pseudonymous learner id (FNV-1a). The gateway sees this, never a name,
 * an email or an exact location — the profile is a study goal, not an identity.
 */
export function pseudonymousLearnerId(profile = {}) {
  const seed = [profile.language, profile.level, profile.country, profile.goal, profile.date]
    .map((part) => String(part ?? "").toLocaleLowerCase().trim())
    .join("|");
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `lnr_${hash.toString(36).padStart(7, "0")}`;
}

const REDACTION_RULES = [
  { type: "email", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/g, replacement: "[email removed]" },
  { type: "phone", pattern: /(?:\+?\d[\d\s().-]{7,}\d)/g, replacement: "[phone removed]" },
  { type: "id-number", pattern: /\b(?:[A-Z]{1,3}[- ]?)?\d{6,}\b/g, replacement: "[id removed]" },
  { type: "url", pattern: /https?:\/\/\S+/g, replacement: "[link removed]" },
];

/**
 * Remove direct identifiers before learner prose is sent for feedback. This
 * runs before the gateway's own PII guardrail so the two layers are
 * independent — a misconfigured guardrail cannot become a data-exposure bug.
 */
export function redactPersonalData(input) {
  let text = String(input ?? "");
  const redactions = [];
  for (const rule of REDACTION_RULES) {
    const matches = text.match(rule.pattern);
    if (!matches || matches.length === 0) continue;
    redactions.push({ type: rule.type, count: matches.length });
    text = text.replace(rule.pattern, rule.replacement);
  }
  return { text, redactions };
}

/** Flat string map attached as `x-tfy-metadata` on every gateway request. */
export function buildRequestMetadata({ config, feature, learnerId, language, strategy }) {
  return {
    application: "sologurus",
    tenant: config.tenant,
    cost_center: config.costCenter,
    environment: config.environment,
    feature: feature.id,
    learner_id: learnerId,
    target_language: language ?? "",
    strategy: strategy ?? "",
    contains_learner_prose: feature.sendsLearnerProse ? "true" : "false",
  };
}

const dayKey = (timestamp) => new Date(timestamp).toISOString().slice(0, 10);

/** In-memory spend mirror: `${learnerId}:${featureId}:${day}` → usage. */
const ledger = new Map();

export function readLedger(learnerId, featureId, now = Date.now()) {
  return ledger.get(`${learnerId}:${featureId}:${dayKey(now)}`) ?? { calls: 0, tokens: 0, costUsd: 0 };
}

export function recordUsage(learnerId, featureId, telemetry, now = Date.now()) {
  const key = `${learnerId}:${featureId}:${dayKey(now)}`;
  const current = ledger.get(key) ?? { calls: 0, tokens: 0, costUsd: 0 };
  const next = {
    calls: current.calls + 1,
    tokens: current.tokens + Number(telemetry?.usage?.totalTokens ?? 0),
    costUsd: Math.round((current.costUsd + Number(telemetry?.estimatedCostUsd ?? 0)) * 1e6) / 1e6,
  };
  ledger.set(key, next);
  return next;
}

export function resetLedger() {
  ledger.clear();
}

/**
 * Decide whether a request may proceed, and report the remaining headroom. A
 * feature that never calls a model declares `dailyTokenCeiling: 0` and is
 * metered on calls alone.
 */
export function evaluateBudget(learnerId, feature, now = Date.now()) {
  const used = readLedger(learnerId, feature.id, now);
  const tokenMetered = feature.dailyTokenCeiling > 0;
  const remainingCalls = Math.max(0, feature.dailyCallCeiling - used.calls);
  const remainingTokens = tokenMetered ? Math.max(0, feature.dailyTokenCeiling - used.tokens) : 0;
  const allowed = remainingCalls > 0 && (!tokenMetered || remainingTokens > 0);
  return {
    allowed,
    tokenMetered,
    used,
    remainingCalls,
    remainingTokens,
    ceilingCalls: feature.dailyCallCeiling,
    ceilingTokens: feature.dailyTokenCeiling,
    reason: allowed
      ? ""
      : remainingCalls === 0
        ? `Daily ${feature.label.toLowerCase()} limit of ${feature.dailyCallCeiling} requests reached for this learner.`
        : `Daily ${feature.label.toLowerCase()} token budget reached for this learner.`,
  };
}

/**
 * Drop any source the model produced that is not in the curated allowlist.
 * Sologurus never shows an exam centre or a resource it cannot attribute, so a
 * citation the catalog does not contain is removed rather than displayed.
 */
export function keepGroundedCitations(citations, allowedNames) {
  const allowed = new Map(allowedNames.map((name) => [String(name).toLocaleLowerCase(), String(name)]));
  const kept = [];
  const dropped = [];
  for (const citation of Array.isArray(citations) ? citations : []) {
    const name = String(citation ?? "").trim();
    if (!name) continue;
    const match = allowed.get(name.toLocaleLowerCase());
    if (match && !kept.includes(match)) kept.push(match);
    else if (!match) dropped.push(name);
  }
  return { kept, dropped };
}
