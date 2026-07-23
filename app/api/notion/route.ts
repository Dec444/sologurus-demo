const NOTION_API_VERSION = "2026-03-11";

type NotionRequest = {
  profile?: { language?: string; level?: string; city?: string; country?: string; goal?: string; date?: string; hours?: number };
  plan?: { id?: string; name?: string; tagline?: string; split?: string; outcome?: string; sample?: string[] };
  resources?: {
    recommendation?: { name?: string; reason?: string; sourceUrl?: string };
    tests?: Array<{ name?: string; fit?: string; sourceUrl?: string }>;
    testCenters?: Array<{ name?: string; address?: string; registrationUrl?: string }>;
    youtube?: Array<{ name?: string; bestFor?: string; url?: string }>;
    forums?: Array<{ name?: string; bestFor?: string; url?: string }>;
    tvShows?: Array<{ name?: string; genre?: string; origin?: string; level?: string; url?: string }>;
    mockExams?: Array<{ name?: string; exam?: string; access?: string; url?: string }>;
    materials?: Record<string, Array<{ name?: string; use?: string; url?: string }>>;
  };
};

const text = (content: string, bold = false, url?: string) => ({
  type: "text",
  text: { content: content.slice(0, 1900), ...(url ? { link: { url } } : {}) },
  annotations: { bold },
});

const heading = (content: string) => ({ object: "block", type: "heading_2", heading_2: { rich_text: [text(content)] } });
const bullet = (name: string, detail: string, url?: string) => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: [text(name, true, url), text(detail ? ` — ${detail}` : "")] },
});

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.NOTION_TOKEN && (process.env.NOTION_TARGET_PAGE_ID || process.env.NOTION_PARENT_PAGE_ID)),
    mode: process.env.NOTION_TARGET_PAGE_ID ? "update" : process.env.NOTION_PARENT_PAGE_ID ? "create" : null,
  });
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;
  const targetPageId = process.env.NOTION_TARGET_PAGE_ID;

  if (!token || (!parentPageId && !targetPageId)) {
    return Response.json({
      ok: false,
      code: "NOTION_NOT_CONFIGURED",
      message: "Add NOTION_TOKEN and either NOTION_TARGET_PAGE_ID or NOTION_PARENT_PAGE_ID to the server environment, then try again.",
    }, { status: 503 });
  }

  let body: NotionRequest;
  try {
    body = await request.json() as NotionRequest;
  } catch {
    return Response.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const profile = body.profile;
  const plan = body.plan;
  const resources = body.resources;
  if (!profile?.goal || !profile.date || !plan?.name || !Array.isArray(plan.sample) || plan.sample.length === 0 || !resources?.youtube?.length || !resources.forums?.length || !resources.tvShows?.length || !resources.mockExams?.length) {
    return Response.json({ ok: false, message: "The learner profile, selected plan, and current research results are required." }, { status: 400 });
  }

  const title = `Sologurus · ${plan.name} · ${profile.goal}`.slice(0, 180);
  const tasks = plan.sample.slice(0, 12);
  const children = [
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { type: "emoji", emoji: "🌱" },
        rich_text: [text(`${profile.hours ?? 0} hours/week · ${profile.language ?? "Target language"} · ${profile.level ?? "Level not set"}`)],
        color: "green_background",
      },
    },
    heading("Learning goal"),
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`${profile.goal} by ${profile.date}. Based in ${profile.city ?? ""}, ${profile.country ?? ""}.`)] } },
    heading("Selected strategy"),
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`${plan.name}: `, true), text(plan.tagline ?? plan.outcome ?? "Personalized study plan")] } },
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`Skill split: ${plan.split ?? "Balanced across skills"}`)] } },
    heading("Recommended test"),
    bullet(resources.recommendation?.name ?? "Language proficiency test", resources.recommendation?.reason ?? "Confirm current acceptance and dates.", resources.recommendation?.sourceUrl),
    heading("Recognized tests and centre sources"),
    ...(resources.tests ?? []).slice(0, 6).map((item) => bullet(item.name ?? "Recognized test", item.fit ?? "Confirm acceptance for the learner's goal.", item.sourceUrl)),
    ...(resources.testCenters ?? []).slice(0, 5).map((item) => bullet(item.name ?? "Official centre source", item.address ?? "Check current locations and dates.", item.registrationUrl)),
    heading("Week one tasks"),
    ...tasks.map((task) => ({
      object: "block",
      type: "to_do",
      to_do: { rich_text: [text(task)], checked: false, color: "default" },
    })),
    heading("Recommended educators"),
    ...resources.youtube.slice(0, 10).map((item) => bullet(item.name ?? "Educator", item.bestFor ?? "Language study", item.url)),
    heading("Study forums"),
    ...resources.forums.slice(0, 3).map((item) => bullet(item.name ?? "Study forum", item.bestFor ?? "Peer learning", item.url)),
    heading("TV immersion watchlist"),
    ...resources.tvShows.slice(0, 10).map((item) => bullet(item.name ?? "TV show", `${item.genre ?? "Series"} · ${item.origin ?? profile.language ?? "Target language"} · suggested ${item.level ?? "mixed levels"}`, item.url)),
    heading("Mock exam platforms"),
    ...resources.mockExams.slice(0, 3).map((item) => bullet(item.name ?? "Mock exam", `${item.exam ?? "Language exam"} · ${item.access ?? "Practice platform"}`, item.url)),
    ...Object.entries(resources.materials ?? {}).flatMap(([skill, items]) => [
      heading(`${skill[0]?.toUpperCase() ?? ""}${skill.slice(1)} resources`),
      ...items.slice(0, 5).map((item) => bullet(item.name ?? "Study material", item.use ?? "Skill practice", item.url)),
    ]),
    heading("Daily reflection"),
    { object: "block", type: "quote", quote: { rich_text: [text("What did I finish? What felt difficult? What is tomorrow’s smallest useful next step?")] } },
  ];

  const notionHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };

  if (targetPageId) {
    const existingResponse = await fetch(`https://api.notion.com/v1/blocks/${targetPageId}/children?page_size=100`, { headers: notionHeaders });
    const existing = await existingResponse.json() as { results?: Array<{ id?: string }>; message?: string; code?: string };
    if (!existingResponse.ok) {
      return Response.json({ ok: false, code: existing.code ?? "NOTION_READ_FAILED", message: existing.message ?? "Could not read the target Notion page." }, { status: existingResponse.status || 502 });
    }

    for (const block of existing.results ?? []) {
      if (!block.id) continue;
      const archiveResponse = await fetch(`https://api.notion.com/v1/blocks/${block.id}`, { method: "DELETE", headers: notionHeaders });
      if (!archiveResponse.ok) {
        const failure = await archiveResponse.json() as { message?: string; code?: string };
        return Response.json({ ok: false, code: failure.code ?? "NOTION_CLEAR_FAILED", message: failure.message ?? "Could not replace the previous Notion plan." }, { status: archiveResponse.status || 502 });
      }
    }

    const pageResponse = await fetch(`https://api.notion.com/v1/pages/${targetPageId}`, {
      method: "PATCH",
      headers: notionHeaders,
      body: JSON.stringify({ properties: { title: { type: "title", title: [text(title)] } } }),
    });
    const page = await pageResponse.json() as { url?: string; message?: string; code?: string };
    if (!pageResponse.ok || !page.url) {
      return Response.json({ ok: false, code: page.code ?? "NOTION_UPDATE_FAILED", message: page.message ?? "Could not update the target Notion page." }, { status: pageResponse.status || 502 });
    }

    const appendResponse = await fetch(`https://api.notion.com/v1/blocks/${targetPageId}/children`, {
      method: "PATCH",
      headers: notionHeaders,
      body: JSON.stringify({ children }),
    });
    const appended = await appendResponse.json() as { message?: string; code?: string };
    if (!appendResponse.ok) {
      return Response.json({ ok: false, code: appended.code ?? "NOTION_APPEND_FAILED", message: appended.message ?? "Could not write the selected plan to Notion." }, { status: appendResponse.status || 502 });
    }

    return Response.json({ ok: true, url: page.url, mode: "updated" });
  }

  const notionResponse = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders,
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId! },
      icon: { type: "emoji", emoji: "🌱" },
      properties: { title: { type: "title", title: [text(title)] } },
      children,
    }),
  });

  const result = await notionResponse.json() as { url?: string; message?: string; code?: string };
  if (!notionResponse.ok || !result.url) {
    return Response.json({
      ok: false,
      code: result.code ?? "NOTION_WRITE_FAILED",
      message: result.message ?? "Notion rejected the page write. Check the integration access and parent page ID.",
    }, { status: notionResponse.status || 502 });
  }

  return Response.json({ ok: true, url: result.url, mode: "created" });
}
