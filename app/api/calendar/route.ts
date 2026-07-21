export async function GET() {
  return Response.json({
    connected: Boolean(process.env.GOOGLE_CALENDAR_EVENT_URL),
    eventUrl: process.env.GOOGLE_CALENDAR_EVENT_URL ?? null,
  });
}
