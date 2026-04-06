/**
 * GRADUM PIPELINE — Real API Integrations
 * Claude API: IG handle matching
 * Apify API: MaxPreps / PBR / USSSA roster collection
 */

const APIFY_TOKEN = process.env.APIFY_API_TOKEN!;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

// ─── CLAUDE IG MATCHING ───────────────────────────────────────────────────────

export interface AthleteProfile {
  firstName: string;
  lastName: string;
  gradYear: number | null;
  schoolName: string | null;
  travelTeam: string | null;
  city: string | null;
  state: string | null;
  position: string | null;
  sport: string;
}

export interface IgMatchResult {
  handle: string | null;
  confidence: number;
  status: "matched" | "low_confidence" | "review" | "not_found";
  strategy: string;
  reasoning: string;
  alternates: string[];
}

export async function matchIgHandle(athlete: AthleteProfile): Promise<IgMatchResult> {
  // State area code reference
  const areaCodeHint = athlete.state === "FL" ? "954=Broward, 305=Miami, 561=Palm Beach, 813=Tampa" :
    athlete.state === "TX" ? "832/713=Houston, 512=Austin, 214/972=Dallas" :
    athlete.state === "NC" ? "704=Charlotte, 919=Raleigh" :
    athlete.state === "SC" ? "843=Charleston" : "local area codes";

  const schoolAbbrev = athlete.schoolName
    ? athlete.schoolName.replace(/(High School|HS|Academy)$/i, "").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase()
    : "";

  const prompt = `You are a username pattern analyst for a baseball training company's outreach system. Your job is to generate the most likely Instagram username patterns for athletes so the sales team can search and manually verify them before outreach.

Generate likely Instagram username patterns for this ${athlete.sport} player profile:
- Name: ${athlete.firstName} ${athlete.lastName}
- Grad Year: ${athlete.gradYear || "Unknown"}
- School: ${athlete.schoolName || "Unknown"} (abbrev: ${schoolAbbrev})
- Travel Team: ${athlete.travelTeam || "Unknown"}
- City/State: ${athlete.city || ""}, ${athlete.state || ""}
- Position: ${athlete.position || "Unknown"}

Common patterns for high school ${athlete.sport} players:
- firstlast + grad year short: e.g., jsmith27
- first.last: e.g., mason.rodriguez
- firstname_lastname: e.g., mason_rodriguez
- firstlast + position: e.g., mason_rhp, emma_pitcher
- school abbreviation: e.g., mrod_${schoolAbbrev.toLowerCase() || "kohs"}
- area code variant: e.g., mason${areaCodeHint.split("=")[0].split("/")[0]?.trim()}
- travel team ref: ${athlete.travelTeam ? athlete.travelTeam.toLowerCase().replace(/\s+/g, "").slice(0, 8) : "teamname"}_mason

If the name is very common (Smith, Johnson, Garcia), lower confidence to 40-50.
If the name is unique, confidence can be 70-80.
Never exceed 82 without school + position confirmation.

Return ONLY this JSON (no other text):
{"primary_handle": "most_likely_pattern", "alternates": ["alt1", "alt2", "alt3"], "confidence": 65, "strategy": "Username Pattern Generation", "reasoning": "1-2 sentences on why these patterns are most likely"}`;


  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error: ${err}`);
    }

    const data = await response.json() as any;
    const text = data.content[0].text;

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    const result = JSON.parse(jsonMatch[0]);
    const confidence = Math.min(100, Math.max(0, result.confidence));

    return {
      handle: result.primary_handle || null,
      confidence,
      status: confidence >= 60 ? "matched" : confidence >= 50 ? "low_confidence" : "review",
      strategy: result.strategy || "Claude Analysis",
      reasoning: result.reasoning || "",
      alternates: result.alternates || [],
    };
  } catch (err) {
    console.error("Claude IG match error:", err);
    return { handle: null, confidence: 0, status: "not_found", strategy: "Error", reasoning: String(err), alternates: [] };
  }
}

// ─── APIFY ROSTER COLLECTION ──────────────────────────────────────────────────

export interface ApifyRunResult {
  runId: string;
  status: string;
  datasetId: string | null;
}

export async function startMaxPrepsRosterScrape(
  schoolName: string,
  city: string,
  state: string,
  sport: "baseball" | "softball"
): Promise<ApifyRunResult> {
  // Build MaxPreps search URL — searches for the school's baseball/softball roster
  const stateCode = state.toLowerCase();
  const citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const schoolSlug = schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-hs$|-high-school$/, "");
  
  const rosterUrl = `https://www.maxpreps.com/${stateCode}/${citySlug}/${schoolSlug}/${sport}/roster/`;
  const searchUrl = `https://www.maxpreps.com/search/?q=${encodeURIComponent(schoolName + " " + city + " " + state)}`;

  const pageFunction = `async function pageFunction(context) {
    const { $ } = context;
    const athletes = [];
    
    // Try to extract from roster table
    $('table tbody tr, .roster-table tr, [class*="roster"] tr').each((i, row) => {
      const cells = $(row).find('td');
      if (cells.length >= 3) {
        const name = $(cells[0]).text().trim() || $(cells[1]).text().trim();
        const grade = $(cells).filter((i, c) => /grade|gr\\./i.test($(c).text())).text().trim();
        const position = $(cells).filter((i, c) => /[A-Z]{1,4}/.test($(c).text().trim()) && $(c).text().trim().length <= 4).first().text().trim();
        
        if (name && name.split(' ').length >= 2) {
          athletes.push({ name, grade, position, school: '${schoolName}', city: '${city}', state: '${state}', sport: '${sport}', source: 'MaxPreps', url: context.request.url });
        }
      }
    });
    
    // Also try JSON-LD structured data
    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        if (data['@type'] === 'SportsTeam' && data.athlete) {
          data.athlete.forEach(a => {
            athletes.push({ name: a.name, position: a.jobTitle || '', school: '${schoolName}', city: '${city}', state: '${state}', sport: '${sport}', source: 'MaxPreps JSON-LD', url: context.request.url });
          });
        }
      } catch(e) {}
    });
    
    return athletes;
  }`;

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~web-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startUrls: [{ url: rosterUrl }, { url: searchUrl }],
          pageFunction,
          maxPagesPerCrawl: 5,
          maxConcurrency: 2,
          proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Apify start error: ${response.status} ${errText}`);
    }

    const run = await response.json() as any;
    return {
      runId: run.data?.id || run.id,
      status: run.data?.status || "RUNNING",
      datasetId: run.data?.defaultDatasetId || null,
    };
  } catch (err) {
    console.error("Apify roster scrape error:", err);
    throw err;
  }
}

export async function getApifyRunStatus(runId: string): Promise<{ status: string; datasetId: string | null; itemCount: number }> {
  const response = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );
  const data = await response.json() as any;
  const run = data.data || data;
  return {
    status: run.status || "UNKNOWN",
    datasetId: run.defaultDatasetId || null,
    itemCount: run.stats?.outputItems || 0,
  };
}

export async function getApifyRunResults(datasetId: string): Promise<any[]> {
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=1000`
  );
  const data = await response.json() as any;
  return Array.isArray(data) ? data : data.items || [];
}

// ─── GOOGLE MAPS SCHOOL DISCOVERY ─────────────────────────────────────────────

export async function discoverSchoolsNearFacility(
  facilityName: string,
  lat: number,
  lng: number,
  radiusMiles: number = 40
): Promise<ApifyRunResult> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  
  // Use Apify Google Maps scraper for school discovery
  const tiles = [
    { lat, lng }, // center
    { lat: lat + 0.3, lng }, { lat: lat - 0.3, lng },
    { lat, lng: lng + 0.4 }, { lat, lng: lng - 0.4 },
    { lat: lat + 0.2, lng: lng + 0.3 }, { lat: lat + 0.2, lng: lng - 0.3 },
    { lat: lat - 0.2, lng: lng + 0.3 }, { lat: lat - 0.2, lng: lng - 0.3 },
  ];

  const searchUrls = tiles.map(t => ({
    url: `https://www.google.com/maps/search/high+school/@${t.lat},${t.lng},12z`,
  }));

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/apify~google-maps-scraper/runs?token=${APIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStrings: ["high school"],
          lat: String(lat),
          lng: String(lng),
          zoom: 12,
          maxCrawledPlaces: 200,
          language: "en",
          country: "US",
        }),
      }
    );

    if (!response.ok) throw new Error(`Apify Google Maps error: ${response.status}`);
    const run = await response.json() as any;
    return {
      runId: run.data?.id || run.id,
      status: run.data?.status || "RUNNING",
      datasetId: run.data?.defaultDatasetId || null,
    };
  } catch (err) {
    console.error("School discovery error:", err);
    throw err;
  }
}
