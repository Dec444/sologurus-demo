import { NextRequest, NextResponse } from "next/server";
import catalog from "../../../data/language-resources.json";

type CatalogLanguage = keyof typeof catalog;

function clean(value: string | null, fallback: string) {
  return (value ?? fallback).trim().slice(0, 100);
}

export async function GET(request: NextRequest) {
  const requestedLanguage = clean(request.nextUrl.searchParams.get("language"), "English");
  const language = (requestedLanguage in catalog ? requestedLanguage : "English") as CatalogLanguage;
  const city = clean(request.nextUrl.searchParams.get("city"), "your city");
  const country = clean(request.nextUrl.searchParams.get("country"), "your country");
  const entry = catalog[language];
  const exactLocations = entry.locations.filter(
    (location) => location.city.toLocaleLowerCase() === city.toLocaleLowerCase()
      && location.country.toLocaleLowerCase() === country.toLocaleLowerCase(),
  );
  const directoryResult = {
    name: entry.centerFinder.name,
    provider: entry.centerFinder.provider,
    address: `Official directory for testing near ${city}, ${country}`,
    availability: entry.centerFinder.note,
    registrationUrl: entry.centerFinder.url,
  };

  return NextResponse.json(
    {
      ...entry,
      language,
      requestedLocation: { city, country },
      testCenters: exactLocations.length > 0 ? [...exactLocations, directoryResult] : [directoryResult],
      centerMode: exactLocations.length > 0 ? "verified-local-and-directory" : "official-directory",
      sourceMode: "curated-official",
    },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
