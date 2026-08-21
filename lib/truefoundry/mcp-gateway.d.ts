export type McpServer = { label: string; integrationId: string };
export type McpSkill = { server: string; tool: string };

export type McpConfig = {
  apiKey: string;
  baseUrl: string;
  servers: McpServer[];
  skills: McpSkill[];
  notionParent: string;
  timeoutMs: number;
};

export type McpDescription = {
  configured: boolean;
  baseUrl: string;
  servers: McpServer[];
  skills: string[];
  notionParentConfigured: boolean;
  timeoutMs: number;
};

export type McpTool = { name: string; description: string; permitted: boolean; arguments: string[]; required: string[] };

export type McpToolListing = {
  ok: boolean;
  server: string;
  tools: McpTool[];
  latencyMs: number;
  error: string;
};

export type McpContentBlock = { type: string; text: string };

export type McpCallTelemetry = {
  server: string;
  tool: string;
  latencyMs: number;
  permitted: boolean;
  transport: string;
};

export type McpCallResult = {
  ok: boolean;
  reason: string;
  content: McpContentBlock[];
  telemetry: McpCallTelemetry;
};

export function readMcpConfig(env?: Record<string, string | undefined>): McpConfig;
export function isMcpConfigured(config: McpConfig): boolean;
export function findServer(config: McpConfig, label: string): McpServer | null;
export function serverUrl(config: McpConfig, server: McpServer): string;
export function isToolPermitted(config: McpConfig, serverLabel: string, toolName: string): boolean;
export function describeMcp(config: McpConfig): McpDescription;
export function contentToText(content: McpContentBlock[]): string;

export function listServerTools(
  config: McpConfig,
  server: McpServer,
  options?: { fetchImpl?: typeof fetch; now?: () => number },
): Promise<McpToolListing>;

export function callServerTool(
  config: McpConfig,
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>,
  options?: { fetchImpl?: typeof fetch; now?: () => number },
): Promise<McpCallResult>;
