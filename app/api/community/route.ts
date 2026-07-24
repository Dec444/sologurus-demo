import { NextRequest, NextResponse } from "next/server";
import learners from "../../../data/community-learners.json";

const supportedRadii = [5, 10, 25, 50, 100];
const earthRadiusMiles = 3958.8;

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const distanceMiles = (latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) => {
  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export async function GET(request: NextRequest) {
  const language = request.nextUrl.searchParams.get("language")?.trim() ?? "";
  const latitudeValue = request.nextUrl.searchParams.get("latitude");
  const longitudeValue = request.nextUrl.searchParams.get("longitude");
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  const location = request.nextUrl.searchParams.get("location")?.trim() ?? "Current location";
  const requestedRadius = Number(request.nextUrl.searchParams.get("radius") ?? 10);
  const radius = supportedRadii.includes(requestedRadius) ? requestedRadius : 10;

  if (!language || latitudeValue === null || longitudeValue === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ message: "A target language and valid current-location coordinates are required." }, { status: 400 });
  }

  const matches = learners
    .filter((learner) => learner.language === language)
    .map((learner) => ({
      displayName: learner.displayName,
      city: learner.city,
      country: learner.country,
      language: learner.language,
      level: learner.level,
      availability: learner.availability,
      goal: learner.goal,
      interests: learner.interests,
      distanceMiles: Math.round(distanceMiles(latitude, longitude, learner.latitude, learner.longitude) * 10) / 10,
    }))
    .filter((learner) => learner.distanceMiles <= radius)
    .sort((left, right) => left.distanceMiles - right.distanceMiles);

  const discoveryQuery = encodeURIComponent(`${language} language exchange ${location}`);
  return NextResponse.json({
    language,
    location,
    coordinatesUsed: { latitude, longitude },
    radius,
    matches,
    privacy: "Your live coordinates are used only for this search and are not saved to a learner profile. Results show approximate distance; exact addresses are never shared.",
    directoryMode: "real-location-preview-directory",
    discoveryLinks: [
      { name: "Meetup language exchanges", url: `https://www.meetup.com/find/?keywords=${discoveryQuery}` },
      { name: "Tandem community", url: "https://www.tandem.net/" },
    ],
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
