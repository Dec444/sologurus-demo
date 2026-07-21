const NOTION_API_VERSION = "2026-03-11";

type NotionRequest = {
  profile?: { language?: string; level?: string; city?: string; country?: string; goal?: string; date?: string; hours?: number };
  plan?: { id?: string; name?: string; tagline?: string; split?: string; outcome?: string; sample?: string[] };
};

const text = (content: string, bold = false) => ({
  type: "text",
  text: { content: content.slice(0, 1900) },
  annotations: { bold },
});

export async function GET() {
  return Response.json({
    configured: Boolean(process.env.NOTION_TOKEN && process.env.NOTION_PARENT_PAGE_ID),
    databaseUrl: process.env.NOTION_DATABASE_URL ?? null,
  });
}

export async function POST(request: Request) {
  const token = process.env.NOTION_TOKEN;
  const parentPageId = process.env.NOTION_PARENT_PAGE_ID;

  if (!token || !parentPageId) {
    return Response.json({
      ok: false,
      code: "NOTION_NOT_CONFIGURED",
      message: "Add NOTION_TOKEN and NOTION_PARENT_PAGE_ID to the server environment, then try again.",
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
  if (!profile?.goal || !profile.date || !plan?.name || !Array.isArray(plan.sample) || plan.sample.length === 0) {
    return Response.json({ ok: false, message: "The learner profile and selected plan are required." }, { status: 400 });
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
    { object: "block", type: "heading_2", heading_2: { rich_text: [text("Learning goal")] } },
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`${profile.goal} by ${profile.date}. Based in ${profile.city ?? ""}, ${profile.country ?? ""}.`)] } },
    { object: "block", type: "heading_2", heading_2: { rich_text: [text("Selected strategy")] } },
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`${plan.name}: `, true), text(plan.tagline ?? plan.outcome ?? "Personalized study plan")] } },
    { object: "block", type: "paragraph", paragraph: { rich_text: [text(`Skill split: ${plan.split ?? "Balanced across skills"}`)] } },
    { object: "block", type: "heading_2", heading_2: { rich_text: [text("Week one tasks")] } },
    ...tasks.map((task) => ({
      object: "block",
      type: "to_do",
      to_do: { rich_text: [text(task)], checked: false, color: "default" },
    })),
    { object: "block", type: "heading_2", heading_2: { rich_text: [text("Daily reflection")] } },
    { object: "block", type: "quote", quote: { rich_text: [text("What did I finish? What felt difficult? What is tomorrow’s smallest useful next step?")] } },
  ];

  const notionResponse = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_API_VERSION,
    },
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
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

  return Response.json({ ok: true, url: result.url });
}
