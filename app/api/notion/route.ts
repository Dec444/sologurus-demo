const NOTION_API_VERSION = "2026-03-11";

type StudyPlanRow = {
  day?: number;
  date?: string;
  dateLabel?: string;
  phase?: string;
  focus?: string;
  textbook?: string;
  practice?: string;
  durationMinutes?: number;
};

type NotionRequest = {
  profile?: {
    language?: string;
    level?: string;
    city?: string;
    country?: string;
    goal?: string;
    date?: string;
    hours?: number;
    dailyHours?: number;
    studyDays?: number;
    consistency?: string;
    examExperience?: string;
  };
  feasibility?: {
    status?: string;
    title?: string;
    advice?: string;
    availableHours?: number;
    neededHours?: number;
  };
  plan?: { id?: string; name?: string; tagline?: string; split?: string; outcome?: string; sample?: string[] };
  resources?: {
    recommendation?: { name?: string; reason?: string; sourceUrl?: string };
    tests?: Array<{ name?: string; fit?: string; sourceUrl?: string }>;
    testCenters?: Array<{ name?: string; address?: string; registrationUrl?: string }>;
    youtube?: Array<{ name?: string; bestFor?: string; url?: string }>;
    forums?: Array<{ name?: string; bestFor?: string; url?: string }>;
    tvShows?: Array<{ name?: string; genre?: string; origin?: string; level?: string; url?: string }>;
    mockExams?: Array<{ name?: string; exam?: string; access?: string; url?: string }>;
    textbooks?: Array<{ name?: string; authorPublisher?: string; bestFor?: string; level?: string; url?: string }>;
    materials?: Record<string, Array<{ name?: string; use?: string; url?: string }>>;
  };
  studyPlan?: StudyPlanRow[];
};

type NotionHeaders = Record<string, string>;
type NotionError = { message?: string; code?: string };
type NotionPage = NotionError & { id?: string; url?: string };
type NotionBlock = {
  id?: string;
  type?: string;
  to_do?: {
    checked?: boolean;
    rich_text?: Array<{ plain_text?: string; text?: { content?: string } }>;
  };
};

const text = (content: string, bold = false, url?: string) => ({
  type: "text",
  text: { content: content.slice(0, 1900), ...(url ? { link: { url } } : {}) },
  annotations: { bold },
});

const heading = (content: string) => ({ object: "block", type: "heading_2", heading_2: { rich_text: [text(content)] } });
const paragraph = (content: string) => ({ object: "block", type: "paragraph", paragraph: { rich_text: [text(content)] } });
const bullet = (name: string, detail: string, url?: string) => ({
  object: "block",
  type: "bulleted_list_item",
  bulleted_list_item: { rich_text: [text(name, true, url), text(detail ? ` — ${detail}` : "")] },
});

async function notionFetch(url: string, headers: NotionHeaders, init: RequestInit = {}) {
  return fetch(url, { ...init, headers });
}

async function appendChildren(parentId: string, children: object[], headers: NotionHeaders) {
  for (let index = 0; index < children.length; index += 100) {
    const response = await notionFetch(`https://api.notion.com/v1/blocks/${parentId}/children`, headers, {
      method: "PATCH",
      body: JSON.stringify({ children: children.slice(index, index + 100) }),
    });
    if (!response.ok) {
      const error = await response.json() as NotionError;
      throw Object.assign(new Error(error.message ?? "Could not append blocks to Notion."), {
        code: error.code ?? "NOTION_APPEND_FAILED",
        status: response.status || 502,
      });
    }
  }
}

async function createStudyPlanSubpage(
  parentId: string,
  profile: NonNullable<NotionRequest["profile"]>,
  plan: NonNullable<NotionRequest["plan"]>,
  studyPlan: StudyPlanRow[],
  headers: NotionHeaders,
) {
  const title = `Study plan · ${profile.language ?? "Language"} · ${profile.date ?? "Target date"}`.slice(0, 180);
  const response = await notionFetch("https://api.notion.com/v1/pages", headers, {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentId },
      icon: { type: "emoji", emoji: "📅" },
      properties: { title: { type: "title", title: [text(title)] } },
      children: [
        {
          object: "block",
          type: "callout",
          callout: {
            icon: { type: "emoji", emoji: "✅" },
            rich_text: [text(`${studyPlan.length} dated sessions · ${profile.dailyHours ?? 0} hours per study day · ${plan.name ?? "Selected strategy"}`)],
            color: "blue_background",
          },
        },
        paragraph("Check each session here after studying. Sologurus reads these checkboxes to build daily, weekly, and monthly progress statistics."),
      ],
    }),
  });
  const page = await response.json() as NotionPage;
  if (!response.ok || !page.id || !page.url) {
    throw Object.assign(new Error(page.message ?? "Could not create the Notion study-plan subpage."), {
      code: page.code ?? "NOTION_SUBPAGE_FAILED",
      status: response.status || 502,
    });
  }

  const blocks: object[] = [];
  let previousPhase = "";
  for (const row of studyPlan) {
    if (row.phase && row.phase !== previousPhase) {
      blocks.push(heading(row.phase));
      previousPhase = row.phase;
    }
    const label = [
      `[Sologurus day ${row.day ?? ""}]`,
      row.dateLabel ?? row.date ?? "",
      row.focus ?? "Study session",
      row.textbook ? `Textbook: ${row.textbook}` : "",
      row.practice ? `Practice: ${row.practice}` : "",
      row.durationMinutes ? `${row.durationMinutes} min` : "",
    ].filter(Boolean).join(" · ");
    blocks.push({
      object: "block",
      type: "to_do",
      to_do: { rich_text: [text(label)], checked: false, color: "default" },
    });
  }
  await appendChildren(page.id, blocks, headers);
  return page;
}

function errorResponse(error: unknown, fallbackCode: string, fallbackMessage: string) {
  const typed = error as { code?: string; status?: number; message?: string };
  return Response.json({
    ok: false,
    code: typed.code ?? fallbackCode,
    message: typed.message ?? fallbackMessage,
  }, { status: typed.status ?? 502 });
}

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
  const studyPlan = body.studyPlan;
  if (
    !profile?.goal || !profile.date || !plan?.name || !Array.isArray(plan.sample) || plan.sample.length === 0
    || !resources?.youtube?.length || !resources.forums?.length || !resources.tvShows?.length
    || !resources.mockExams?.length || !resources.textbooks?.length || !studyPlan?.length
  ) {
    return Response.json({ ok: false, message: "The learner profile, selected plan, current research results, and dated study plan are required." }, { status: 400 });
  }

  const title = `Sologurus · ${plan.name} · ${profile.goal}`.slice(0, 180);
  const feasibility = body.feasibility;
  const children = [
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { type: "emoji", emoji: "🌱" },
        rich_text: [text(`${profile.dailyHours ?? 0} hours/day · ${profile.studyDays ?? 0} days/week · ${profile.hours ?? 0} hours/week · ${profile.language ?? "Target language"} · ${profile.level ?? "Level not set"}`)],
        color: "green_background",
      },
    },
    heading("Learning goal"),
    paragraph(`${profile.goal} by ${profile.date}. Based in ${profile.city ?? ""}, ${profile.country ?? ""}.`),
    heading("Feasibility check"),
    paragraph(`${feasibility?.title ?? "Schedule checked."} ${feasibility?.advice ?? ""}`),
    heading("Selected strategy"),
    paragraph(`${plan.name}: ${plan.tagline ?? plan.outcome ?? "Personalized study plan"}`),
    paragraph(`Skill split: ${plan.split ?? "Balanced across skills"}`),
    heading("Recommended test"),
    bullet(resources.recommendation?.name ?? "Language proficiency test", resources.recommendation?.reason ?? "Confirm current acceptance and dates.", resources.recommendation?.sourceUrl),
    heading("Recognized tests and centre sources"),
    ...(resources.tests ?? []).slice(0, 6).map((item) => bullet(item.name ?? "Recognized test", item.fit ?? "Confirm acceptance for the learner's goal.", item.sourceUrl)),
    ...(resources.testCenters ?? []).slice(0, 5).map((item) => bullet(item.name ?? "Official centre source", item.address ?? "Check current locations and dates.", item.registrationUrl)),
    heading("Recommended educators"),
    ...resources.youtube.slice(0, 10).map((item) => bullet(item.name ?? "Educator", item.bestFor ?? "Language study", item.url)),
    heading("Study forums"),
    ...resources.forums.slice(0, 3).map((item) => bullet(item.name ?? "Study forum", item.bestFor ?? "Peer learning", item.url)),
    heading("TV immersion watchlist"),
    ...resources.tvShows.slice(0, 10).map((item) => bullet(item.name ?? "TV show", `${item.genre ?? "Series"} · ${item.origin ?? profile.language ?? "Target language"} · suggested ${item.level ?? "mixed levels"}`, item.url)),
    ...Object.entries(resources.materials ?? {}).flatMap(([skill, items]) => [
      heading(`${skill[0]?.toUpperCase() ?? ""}${skill.slice(1)} resources`),
      ...items.slice(0, 5).map((item) => bullet(item.name ?? "Study material", item.use ?? "Skill practice", item.url)),
    ]),
    heading("Textbook recommendations"),
    ...resources.textbooks.slice(0, 3).map((item) => bullet(item.name ?? "Textbook", `${item.authorPublisher ?? "Established publisher"} · ${item.bestFor ?? "Structured study"} · ${item.level ?? "mixed levels"}`, item.url)),
    heading("Mock exam platforms"),
    ...resources.mockExams.slice(0, 3).map((item) => bullet(item.name ?? "Mock exam", `${item.exam ?? "Language exam"} · ${item.access ?? "Practice platform"}`, item.url)),
    heading("Daily reflection"),
    { object: "block", type: "quote", quote: { rich_text: [text("What did I finish? What felt difficult? What is tomorrow’s smallest useful next step?")] } },
  ];

  const notionHeaders: NotionHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };

  try {
    let overviewPage: NotionPage;
    let overviewPageId: string;
    if (targetPageId) {
      const existingResponse = await notionFetch(`https://api.notion.com/v1/blocks/${targetPageId}/children?page_size=100`, notionHeaders);
      const existing = await existingResponse.json() as NotionError & { results?: Array<{ id?: string }> };
      if (!existingResponse.ok) {
        throw Object.assign(new Error(existing.message ?? "Could not read the target Notion page."), {
          code: existing.code ?? "NOTION_READ_FAILED",
          status: existingResponse.status || 502,
        });
      }

      for (const block of existing.results ?? []) {
        if (!block.id) continue;
        const archiveResponse = await notionFetch(`https://api.notion.com/v1/blocks/${block.id}`, notionHeaders, { method: "DELETE" });
        if (!archiveResponse.ok) {
          const failure = await archiveResponse.json() as NotionError;
          throw Object.assign(new Error(failure.message ?? "Could not replace the previous Notion plan."), {
            code: failure.code ?? "NOTION_CLEAR_FAILED",
            status: archiveResponse.status || 502,
          });
        }
      }

      const pageResponse = await notionFetch(`https://api.notion.com/v1/pages/${targetPageId}`, notionHeaders, {
        method: "PATCH",
        body: JSON.stringify({ properties: { title: { type: "title", title: [text(title)] } } }),
      });
      overviewPage = await pageResponse.json() as NotionPage;
      if (!pageResponse.ok || !overviewPage.url) {
        throw Object.assign(new Error(overviewPage.message ?? "Could not update the target Notion page."), {
          code: overviewPage.code ?? "NOTION_UPDATE_FAILED",
          status: pageResponse.status || 502,
        });
      }
      overviewPageId = targetPageId;
      await appendChildren(overviewPageId, children, notionHeaders);
    } else {
      const notionResponse = await notionFetch("https://api.notion.com/v1/pages", notionHeaders, {
        method: "POST",
        body: JSON.stringify({
          parent: { type: "page_id", page_id: parentPageId! },
          icon: { type: "emoji", emoji: "🌱" },
          properties: { title: { type: "title", title: [text(title)] } },
          children,
        }),
      });
      overviewPage = await notionResponse.json() as NotionPage;
      if (!notionResponse.ok || !overviewPage.id || !overviewPage.url) {
        throw Object.assign(new Error(overviewPage.message ?? "Notion rejected the page write. Check the integration access and parent page ID."), {
          code: overviewPage.code ?? "NOTION_WRITE_FAILED",
          status: notionResponse.status || 502,
        });
      }
      overviewPageId = overviewPage.id;
    }

    const planPage = await createStudyPlanSubpage(overviewPageId, profile, plan, studyPlan, notionHeaders);
    return Response.json({
      ok: true,
      url: overviewPage.url,
      planPageId: planPage.id,
      planUrl: planPage.url,
      mode: targetPageId ? "updated" : "created",
    });
  } catch (error) {
    return errorResponse(error, "NOTION_WRITE_FAILED", "Could not write the study system to Notion.");
  }
}

export async function PUT(request: Request) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return Response.json({ ok: false, code: "NOTION_NOT_CONFIGURED", message: "Add NOTION_TOKEN before syncing progress." }, { status: 503 });
  }

  let planPageId = "";
  try {
    const body = await request.json() as { planPageId?: string };
    planPageId = body.planPageId?.trim() ?? "";
  } catch {
    return Response.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }
  if (!planPageId) return Response.json({ ok: false, message: "A Notion study-plan page ID is required." }, { status: 400 });

  const notionHeaders: NotionHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };

  try {
    const blocks: NotionBlock[] = [];
    let cursor = "";
    do {
      const url = new URL(`https://api.notion.com/v1/blocks/${planPageId}/children`);
      url.searchParams.set("page_size", "100");
      if (cursor) url.searchParams.set("start_cursor", cursor);
      const response = await notionFetch(url.toString(), notionHeaders);
      const result = await response.json() as NotionError & { results?: NotionBlock[]; has_more?: boolean; next_cursor?: string | null };
      if (!response.ok) {
        throw Object.assign(new Error(result.message ?? "Could not read progress from Notion."), {
          code: result.code ?? "NOTION_PROGRESS_READ_FAILED",
          status: response.status || 502,
        });
      }
      blocks.push(...(result.results ?? []));
      cursor = result.has_more && result.next_cursor ? result.next_cursor : "";
    } while (cursor);

    const completedDays = blocks.flatMap((block) => {
      if (block.type !== "to_do" || !block.to_do?.checked) return [];
      const content = (block.to_do.rich_text ?? []).map((item) => item.plain_text ?? item.text?.content ?? "").join("");
      const day = Number(content.match(/\[Sologurus day (\d+)\]/)?.[1]);
      return Number.isFinite(day) && day > 0 ? [day] : [];
    }).sort((a, b) => a - b);

    return Response.json({ ok: true, completedDays });
  } catch (error) {
    return errorResponse(error, "NOTION_PROGRESS_READ_FAILED", "Could not read progress from the Notion study-plan subpage.");
  }
}
