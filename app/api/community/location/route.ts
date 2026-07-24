import { NextRequest, NextResponse } from "next/server";

type ResolvedLocation = { label: string; city: string; region: string; country: string; attribution: string };
const locationCache = new Map<string, ResolvedLocation>();

export async function GET(request: NextRequest) {
  const latitudeValue = request.nextUrl.searchParams.get("latitude");
  const longitudeValue = request.nextUrl.searchParams.get("longitude");
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  if (latitudeValue === null || longitudeValue === null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return NextResponse.json({ message: "Valid latitude and longitude are required." }, { status: 400 });
  }

  const roundedLatitude = Math.round(latitude * 1000) / 1000;
  const roundedLongitude = Math.round(longitude * 1000) / 1000;
  const cacheKey = `${roundedLatitude},${roundedLongitude}`;
  const cached = locationCache.get(cacheKey);
  if (cached) return NextResponse.json({ ...cached, coordinates: { latitude, longitude } }, { headers: { "Cache-Control": "private, max-age=300" } });

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(roundedLatitude));
  url.searchParams.set("lon", String(roundedLongitude));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Sologurus/1.0 (https://sologurus-study-agent.lu-liu398220.chatgpt.site)",
        Referer: "https://sologurus-study-agent.lu-liu398220.chatgpt.site/",
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error("Location lookup failed.");
    const result = await response.json() as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        county?: string;
        state?: string;
        country?: string;
      };
    };
    const address = result.address ?? {};
    const city = address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? "Current area";
    const region = address.state ?? address.county ?? "";
    const country = address.country ?? "";
    const label = [city, region !== city ? region : "", country].filter(Boolean).join(", ");
    const resolved = { label, city, region, country, attribution: "Location resolved with OpenStreetMap Nominatim" };
    if (locationCache.size >= 200) locationCache.delete(locationCache.keys().next().value ?? "");
    locationCache.set(cacheKey, resolved);
    return NextResponse.json({ ...resolved, coordinates: { latitude, longitude } }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({
      label: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
      city: "",
      region: "",
      country: "",
      attribution: "Live device coordinates; place name temporarily unavailable",
      coordinates: { latitude, longitude },
    }, { headers: { "Cache-Control": "no-store" } });
  }
}
