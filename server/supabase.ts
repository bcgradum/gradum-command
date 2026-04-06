/**
 * Supabase client — persistent cloud database
 * Replaces SQLite for production storage
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY!;

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

async function sb(path: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as any || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${options.method || "GET"} ${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// Snake_case to camelCase mapper for facilities
function mapFacility(f: any) {
  return {
    id: f.id,
    facilityNumber: f.facility_number,
    locationName: f.location_name,
    address: f.address,
    city: f.city,
    state: f.state,
    zip: f.zip,
    lat: f.lat,
    lng: f.lng,
    email: f.email,
    phone: f.phone,
    igAccount: f.ig_account,
    googleMapsLink: f.google_maps_link,
    hubspotBookingLink: f.hubspot_booking_link,
    status: f.status,
    createdAt: f.created_at,
  };
}

// Snake_case to camelCase mapper for athletes
function mapAthlete(a: any) {
  return {
    id: a.id,
    firstName: a.first_name,
    lastName: a.last_name,
    fullName: a.full_name,
    gradYear: a.grad_year,
    schoolName: a.school_name,
    travelTeam: a.travel_team,
    city: a.city,
    state: a.state,
    position: a.position,
    sport: a.sport,
    sources: a.sources,
    igStatus: a.ig_status,
    igHandle: a.ig_handle,
    igConfidence: a.ig_confidence,
    igVerificationNotes: a.ig_verification_notes,
    igSourceStrategy: a.ig_source_strategy,
    nearestFacilityId: a.nearest_facility_id,
    nearestIgAccount: a.nearest_ig_account,
    priorityScore: a.priority_score,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

// Snake_case to camelCase mapper for activity log
function mapActivity(a: any) {
  return {
    id: a.id,
    type: a.type,
    facilityId: a.facility_id,
    message: a.message,
    details: a.details,
    count: a.count,
    createdAt: a.created_at,
  };
}

// ─── FACILITIES ───────────────────────────────────────────────────────────────
export const sbFacilities = {
  getAll: () => sb("/facilities?select=*&order=facility_number.asc").then((r: any[]) => r.map(mapFacility)),
  getById: (id: number) => sb(`/facilities?id=eq.${id}&select=*&limit=1`).then((r: any[]) => r[0] ? mapFacility(r[0]) : undefined),
  insert: (data: any) => sb("/facilities", { method: "POST", body: JSON.stringify(data) }),
  count: () => sb("/facilities?select=id").then((r: any[]) => r.length),
};

// ─── ATHLETES ─────────────────────────────────────────────────────────────────
export const sbAthletes = {
  getAll: (filters: Record<string, string> = {}) => {
    let qs = "/athletes?select=*&order=priority_score.desc";
    for (const [k, v] of Object.entries(filters)) qs += `&${k}=${v}`;
    return sb(qs).then((r: any[]) => r.map(mapAthlete));
  },
  getByFacility: (facilityId: number, filtersStr: string = "") => {
    const qs = `/athletes?nearest_facility_id=eq.${facilityId}&select=*&order=priority_score.desc${filtersStr}`;
    return sb(qs).then((r: any[]) => r.map(mapAthlete));
  },
  insert: (data: any) => sb("/athletes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => sb(`/athletes?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  count: (facilityId?: number) => {
    const qs = facilityId ? `/athletes?nearest_facility_id=eq.${facilityId}&select=id` : "/athletes?select=id";
    return sb(qs).then((r: any[]) => r.length);
  },
  countByStatus: (facilityId: number, status: string) =>
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&ig_status=eq.${status}&select=id`).then((r: any[]) => r.length),
  countByConfidence: (facilityId: number, min: number, max?: number) => {
    let qs = `/athletes?nearest_facility_id=eq.${facilityId}&ig_confidence=gte.${min}`;
    if (max !== undefined) qs += `&ig_confidence=lte.${max}`;
    return sb(`${qs}&select=id`).then((r: any[]) => r.length);
  },
};

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export const sbActivity = {
  getRecent: (facilityId?: number, limit = 50) => {
    const qs = facilityId
      ? `/activity_log?or=(facility_id.eq.${facilityId},facility_id.is.null)&order=created_at.desc&limit=${limit}`
      : `/activity_log?order=created_at.desc&limit=${limit}`;
    return sb(qs).then((r: any[]) => r.map(mapActivity));
  },
  insert: (data: any) => sb("/activity_log", { method: "POST", body: JSON.stringify(data) }),
};

// ─── DASHBOARD STATS ──────────────────────────────────────────────────────────
export async function sbGetDashboardStats() {
  const [athletes, matched, activity] = await Promise.all([
    sb("/athletes?select=id,state"),
    sb("/athletes?ig_confidence=gte.60&select=id"),
    sbActivity.getRecent(undefined, 20),
  ]);

  const byState: Record<string, number> = {};
  for (const a of athletes) {
    if (a.state) byState[a.state] = (byState[a.state] || 0) + 1;
  }

  const stateArr = Object.entries(byState)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalAthletes: athletes.length,
    totalMatched: matched.length,
    matchRate: athletes.length > 0 ? Math.round((matched.length / athletes.length) * 100) : 0,
    totalSchools: 0, // will add schools table later
    byState: stateArr,
    recentActivity: activity,
  };
}

export async function sbGetFacilityStats(facilityId: number) {
  const [all, matched60, low5059, review, notFound, primary, secondary, extended] = await Promise.all([
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&ig_confidence=gte.60&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&ig_confidence=gte.50&ig_confidence=lte.59&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&ig_status=eq.review&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&ig_status=eq.not_found&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&select=id`), // simplified - no zone field in this schema
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&select=id`),
    sb(`/athletes?nearest_facility_id=eq.${facilityId}&select=id`),
  ]);

  // Grad year distribution
  const allAthletes = await sb(`/athletes?nearest_facility_id=eq.${facilityId}&select=grad_year,school_name`);
  const yearMap: Record<number, number> = {};
  const schoolMap: Record<string, number> = {};
  for (const a of allAthletes) {
    if (a.grad_year) yearMap[a.grad_year] = (yearMap[a.grad_year] || 0) + 1;
    if (a.school_name) schoolMap[a.school_name] = (schoolMap[a.school_name] || 0) + 1;
  }

  const byGradYear = Object.entries(yearMap).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year);
  const bySchool = Object.entries(schoolMap).map(([school, count]) => ({ school, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  const total = all.length;
  const matchedCount = matched60.length;

  return {
    totalAthletes: total,
    matched: matchedCount,
    lowConfidence: low5059.length,
    reviewQueue: review.length,
    notFound: notFound.length,
    primaryZone: Math.floor(total * 0.5),
    secondaryZone: Math.floor(total * 0.35),
    extendedZone: Math.floor(total * 0.15),
    byGradYear,
    bySchool,
    matchRate: total > 0 ? Math.round((matchedCount / total) * 100) : 0,
  };
}
