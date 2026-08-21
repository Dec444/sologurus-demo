import type { GatewayConfig, GatewayTelemetry } from "./truefoundry";

export type AiFeature = {
  id: string;
  label: string;
  purpose: string;
  maxOutputTokens: number;
  dailyCallCeiling: number;
  dailyTokenCeiling: number;
  sendsLearnerProse: boolean;
  promptLogging: boolean;
};

export type LedgerEntry = { calls: number; tokens: number; costUsd: number };

export type BudgetVerdict = {
  allowed: boolean;
  /** False for features that never call a model; they are metered on calls alone. */
  tokenMetered: boolean;
  used: LedgerEntry;
  remainingCalls: number;
  remainingTokens: number;
  ceilingCalls: number;
  ceilingTokens: number;
  reason: string;
};

export const AI_FEATURES: AiFeature[];

export function findFeature(featureId: string): AiFeature | null;
export function pseudonymousLearnerId(profile: Record<string, unknown>): string;
export function redactPersonalData(input: string): { text: string; redactions: Array<{ type: string; count: number }> };
export function buildRequestMetadata(options: {
  config: GatewayConfig;
  feature: AiFeature;
  learnerId: string;
  language?: string;
  strategy?: string;
}): Record<string, string>;
export function readLedger(learnerId: string, featureId: string, now?: number): LedgerEntry;
export function recordUsage(learnerId: string, featureId: string, telemetry: GatewayTelemetry, now?: number): LedgerEntry;
export function resetLedger(): void;
export function evaluateBudget(learnerId: string, feature: AiFeature, now?: number): BudgetVerdict;
export function keepGroundedCitations(citations: unknown, allowedNames: string[]): { kept: string[]; dropped: string[] };
