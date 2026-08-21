import catalog from "../../data/language-resources.json";
import communities from "../../data/language-communities.json";
import mediaAndExams from "../../data/language-media-exams.json";
import textbooks from "../../data/language-textbooks.json";

type CatalogLanguage = keyof typeof catalog;

export type ResourceCatalog = ReturnType<typeof buildResourceCatalog>;

export function resolveLanguage(requested: string): CatalogLanguage {
  return (requested in catalog ? requested : "English") as CatalogLanguage;
}

/**
 * Compose the curated, source-linked catalog for one language and location.
 * Shared by `/api/resources` and by the governed agent route, so the browser
 * and the model always reason over the same records.
 */
export function buildResourceCatalog(requestedLanguage: string, city: string, country: string) {
  const language = resolveLanguage(requestedLanguage);
  const entry = catalog[language];
  const community = communities[language];
  const enrichment = mediaAndExams[language];
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

  return {
    ...entry,
    youtube: [...entry.youtube, ...community.youtube],
    forums: community.forums,
    tvShows: enrichment.tvShows.map((show) => ({
      ...show,
      url: `https://www.themoviedb.org/search?query=${encodeURIComponent(show.name)}`,
    })),
    mockExams: enrichment.mockExams,
    textbooks: textbooks[language],
    language,
    lastVerified: enrichment.lastVerified,
    requestedLocation: { city, country },
    testCenters: exactLocations.length > 0 ? [...exactLocations, directoryResult] : [directoryResult],
    centerMode: exactLocations.length > 0 ? "verified-local-and-directory" : "official-directory",
    sourceMode: "curated-live-sources",
  };
}

/**
 * Every citable name in the catalog. The agent route validates model citations
 * against this list so a recommendation the catalog cannot attribute is dropped
 * instead of shown.
 */
export function citableSourceNames(resources: ResourceCatalog): string[] {
  return [
    ...resources.tests.map((test) => test.name),
    ...resources.testCenters.map((center) => center.name),
    ...resources.youtube.map((channel) => channel.name),
    ...resources.forums.map((forum) => forum.name),
    ...resources.tvShows.map((show) => show.name),
    ...resources.mockExams.map((mock) => mock.name),
    ...resources.textbooks.map((book) => book.name),
    ...Object.values(resources.materials).flat().map((material) => material.name),
  ];
}

/**
 * Compact digest sent to the model: names, levels and purposes only. URLs and
 * addresses stay on the server — the browser renders those from the catalog, so
 * the model has no opportunity to rewrite a registration link.
 */
export function catalogDigest(resources: ResourceCatalog) {
  return {
    language: resources.language,
    lastVerified: resources.lastVerified,
    recommendedTest: { name: resources.recommendation.name, reason: resources.recommendation.reason },
    tests: resources.tests.map((test) => ({ name: test.name, fit: test.fit, format: test.format })),
    testCentreMode: resources.centerMode,
    educators: resources.youtube.slice(0, 10).map((channel) => ({ name: channel.name, bestFor: channel.bestFor, level: channel.level })),
    forums: resources.forums.map((forum) => ({ name: forum.name, bestFor: forum.bestFor })),
    tvShows: resources.tvShows.map((show) => ({ name: show.name, genre: show.genre, level: show.level })),
    mockExams: resources.mockExams.map((mock) => ({ name: mock.name, exam: mock.exam, access: mock.access })),
    textbooks: resources.textbooks.map((book) => ({ name: book.name, publisher: book.authorPublisher, level: book.level, bestFor: book.bestFor })),
    materials: Object.fromEntries(
      Object.entries(resources.materials).map(([skill, items]) => [
        skill,
        items.map((item) => ({ name: item.name, use: item.use, level: item.level, cost: item.cost })),
      ]),
    ),
  };
}
