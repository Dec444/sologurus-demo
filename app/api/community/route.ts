import { NextRequest, NextResponse } from "next/server";
import learners from "../../../data/community-learners.json";

const supportedRadii = [5, 10, 25, 50, 100];

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("language")?.trim() ?? "";
  const location = request.nextUrl.searchParams.get("location")?.trim() ?? "";
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius") ?? 10);
  const radius = supportedRadii.includes(requestedRadius) ? requestedRadius : 10;

  if (!language || !location) {
    return NextResponse.json({ message: "Language and location are required." }, { status: 400 });
  }

  const locationTerms = location.toLocaleLowerCase().split(",").map((term) => term.trim()).filter(Boolean);
  const matches = learners
    .filter((learner) => learner.language === language)
    .filter((learner) => {
      const searchableLocation = `${learner.city}, ${learner.country}`.toLocaleLowerCase();
      return locationTerms.every((term) => searchableLocation.includes(term));
    })
    .filter((learner) => learner.distanceMiles <= radius)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);

  const discoveryQuery = encodeURIComponent(`${language} language exchange ${location}`);
  return NextResponse.json({
    language,
    location,
    radius,
    matches,
    privacy: "Only approximate distance and opt-in learning details are shown; exact addresses are never shared.",
    directoryMode: "privacy-safe-demo-directory",
    discoveryLinks: [
      { name: "Meetup language exchanges", url: `https://www.meetup.com/find/?keywords=${discoveryQuery}` },
      { name: "Tandem community", url: "https://www.tandem.net/" },
    ],
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
