import { NextRequest, NextResponse } from "next/server";
import { buildResourceCatalog } from "../../../lib/study/catalog";

function clean(value: string | null, fallback: string) {
  return (value ?? fallback).trim().slice(0, 100);
}

export async function GET(request: NextRequest) {
  const language = clean(request.nextUrl.searchParams.get("language"), "English");
  const city = clean(request.nextUrl.searchParams.get("city"), "your city");
  const country = clean(request.nextUrl.searchParams.get("country"), "your country");

  return NextResponse.json(
    buildResourceCatalog(language, city, country),
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
