export type GovernedActionInput = {
  profile?: Record<string, unknown>;
  plan?: Record<string, unknown>;
  feasibility?: Record<string, unknown>;
  studyPlan?: Array<Record<string, unknown>>;
  pageRef?: string;
};

export type GovernedAction = {
  id: string;
  label: string;
  server: string;
  tool: string;
  description: string;
  /** What the caller should do with the tool output. */
  returns: "page-ref" | "completed-days" | "text";
  needsPageRef?: boolean;
  build: (input: GovernedActionInput, options?: { notionParent?: string }) => Record<string, unknown>;
};

export type GovernedActionSummary = Omit<GovernedAction, "build"> & { needsPageRef: boolean };

export const GOVERNED_ACTIONS: GovernedAction[];

export function studyPlanMarkdown(input: GovernedActionInput): string;
export function extractNotionPageRef(output: string): string;
export function parseCompletedDays(markdown: string): number[];
export function findAction(actionId: string): GovernedAction | null;
export function actionsForServer(serverLabel: string): GovernedAction[];
export function describeActions(): GovernedActionSummary[];
