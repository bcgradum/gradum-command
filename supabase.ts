/**
 * Supabase client — persistent cloud database
 * Replaces SQLite for production storage
 *
 * ─── SUPABASE SQL — run these in your Supabase SQL editor ────────────────────
 *
 * CREATE TABLE IF NOT EXISTS bookings (
 *   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *   location TEXT NOT NULL,
 *   date_booked TEXT NOT NULL,
 *   eval_date TEXT NOT NULL,
 *   eval_time TEXT NOT NULL,
 *   lead_name TEXT NOT NULL,
 *   ig_handle TEXT,
 *   phone TEXT,
 *   assigned_rep TEXT,
 *   show_status TEXT,
 *   close_status TEXT,
 *   revenue REAL,
 *   reschedule_date TEXT,
 *   reschedule_time TEXT,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * CREATE TABLE IF NOT EXISTS followups (
 *   id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 *   location TEXT NOT NULL,
 *   date TEXT NOT NULL,
 *   ig_username TEXT NOT NULL,
 *   assigned_rep TEXT,
 *   notes TEXT,
 *   status TEXT NOT NULL DEFAULT 'active',
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 *
 * ────────────────────────────────────────────────────────────────────────────
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

/** Count rows via HEAD + Prefer: count=exact (no row limit!) */
async function sbCount(path: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "HEAD",
    headers: {
      ...headers,
      "Prefer": "count=exact",
      "Range": "0-0",
    },
  });
  const range = res.headers.get("content-range") || "*/0";
  return Number(range.split("/")[1]) || 0;
}

/** Fetch ALL rows (bypasses default 1000 limit) */
async function sbAll(path: string): Promise<any[]> {
  const sep = path.includes("?") ? "&" : "?";
  return sb(`${path}${sep}limit=150000`);
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
    handleStatus: a.handle_status,
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
    let qs = "/athletes?select=*&order=priority_score.desc&limit=150000";
    for (const [k, v] of Object.entries(filters)) qs += `&${k}=${v}`;
    return sb(qs).then((r: any[]) => r.map(mapAthlete));
  },
  getByFacility: (facilityId: number, filtersStr: string = "") => {
    const qs = `/athletes?nearest_facility_id=eq.${facilityId}&select=*&order=priority_score.desc&limit=150000${filtersStr}`;
    return sb(qs).then((r: any[]) => r.map(mapAthlete));
  },
  insert: (data: any) => sb("/athletes", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: any) => sb(`/athletes?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  count: (facilityId?: number) => {
    const qs = facilityId ? `/athletes?nearest_facility_id=eq.${facilityId}&select=id` : "/athletes?select=id";
    return sbCount(qs);
  },
  countByStatus: (facilityId: number, status: string) =>
    sbCount(`/athletes?nearest_facility_id=eq.${facilityId}&ig_status=eq.${status}&select=id`),
  countByConfidence: (facilityId: number, min: number, max?: number) => {
    let qs = `/athletes?nearest_facility_id=eq.${facilityId}&ig_confidence=gte.${min}`;
    if (max !== undefined) qs += `&ig_confidence=lte.${max}`;
    return sbCount(`${qs}&select=id`);
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
// Snake_case to camelCase mapper for bookings
function mapBooking(b: any) {
  return {
    id: b.id,
    location: b.location,
    dateBooked: b.date_booked,
    evalDate: b.eval_date,
    evalTime: b.eval_time,
    leadName: b.lead_name,
    igHandle: b.ig_handle,
    phone: b.phone,
    assignedRep: b.assigned_rep,
    showStatus: b.show_status,
    closeStatus: b.close_status,
    revenue: b.revenue,
    rescheduleDate: b.reschedule_date,
    rescheduleTime: b.reschedule_time,
    notes: b.notes,
    createdAt: b.created_at,
  };
}

// Snake_case to camelCase mapper for followups
function mapFollowup(f: any) {
  return {
    id: f.id,
    location: f.location,
    date: f.date,
    igUsername: f.ig_username,
    assignedRep: f.assigned_rep,
    notes: f.notes,
    status: f.status,
    createdAt: f.created_at,
  };
}

// ─── BOOKINGS ─────────────────────────────────────────────────────────────────
export const sbBookings = {
  getAll: (location?: string) => {
    const qs = location
      ? `/bookings?location=eq.${encodeURIComponent(location)}&select=*&order=created_at.desc`
      : "/bookings?select=*&order=created_at.desc";
    return sb(qs).then((r: any[]) => r.map(mapBooking));
  },
  insert: (data: any) => sb("/bookings", { method: "POST", body: JSON.stringify(data) }).then((r: any) => Array.isArray(r) ? mapBooking(r[0]) : mapBooking(r)),
  update: (id: number, data: any) => sb(`/bookings?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }).then((r: any) => Array.isArray(r) ? mapBooking(r[0]) : mapBooking(r)),
  delete: (id: number) => sb(`/bookings?id=eq.${id}`, { method: "DELETE" }),
};

// ─── FOLLOWUPS ────────────────────────────────────────────────────────────────
export const sbFollowups = {
  getAll: (location?: string) => {
    const qs = location
      ? `/followups?location=eq.${encodeURIComponent(location)}&select=*&order=created_at.desc`
      : "/followups?select=*&order=created_at.desc";
    return sb(qs).then((r: any[]) => r.map(mapFollowup));
  },
  insert: (data: any) => sb("/followups", { method: "POST", body: JSON.stringify(data) }).then((r: any) => Array.isArray(r) ? mapFollowup(r[0]) : mapFollowup(r)),
  update: (id: number, data: any) => sb(`/followups?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data) }).then((r: any) => Array.isArray(r) ? mapFollowup(r[0]) : mapFollowup(r)),
};

export async function sbGetDashboardStats() {
  const [totalAthletes, totalMatched, totalDone, athletes, activity] = await Promise.all([
    sbCount("/athletes?select=id"),
    sbCount("/athletes?ig_confidence=gte.60&select=id"),
    sbCount("/athletes?handle_status=eq.confirmed&select=id"),
    sbAll("/athletes?select=id,state"),
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
    totalAthletes,
    totalMatched,
    matchRate: totalAthletes > 0 ? Math.round((totalMatched / totalAthletes) * 100) : 0,
    totalDone,
    byState: stateArr,
    recentActivity: activity,
  };
}

export async function sbGetFacilityStats(facilityId: number) {
  const fq = `/athletes?nearest_facility_id=eq.${facilityId}`;
  const [total, matchedCount, lowCount, reviewCount, notFoundCount, allAthletes] = await Promise.all([
    sbCount(`${fq}&select=id`),
    sbCount(`${fq}&ig_confidence=gte.60&select=id`),
    sbCount(`${fq}&ig_confidence=gte.50&ig_confidence=lte.59&select=id`),
    sbCount(`${fq}&ig_status=eq.review&select=id`),
    sbCount(`${fq}&ig_status=eq.not_found&select=id`),
    sbAll(`${fq}&select=grad_year,school_name`),
  ]);

  // Grad year distribution
  const yearMap: Record<number, number> = {};
  const schoolMap: Record<string, number> = {};
  for (const a of allAthletes) {
    if (a.grad_year) yearMap[a.grad_year] = (yearMap[a.grad_year] || 0) + 1;
    if (a.school_name) schoolMap[a.school_name] = (schoolMap[a.school_name] || 0) + 1;
  }

  const byGradYear = Object.entries(yearMap).map(([year, count]) => ({ year: Number(year), count })).sort((a, b) => a.year - b.year);
  const bySchool = Object.entries(schoolMap).map(([school, count]) => ({ school, count })).sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    totalAthletes: total,
    matched: matchedCount,
    lowConfidence: lowCount,
    reviewQueue: reviewCount,
    notFound: notFoundCount,
    primaryZone: Math.floor(total * 0.5),
    secondaryZone: Math.floor(total * 0.35),
    extendedZone: Math.floor(total * 0.15),
    byGradYear,
    bySchool,
    matchRate: total > 0 ? Math.round((matchedCount / total) * 100) : 0,
  };
}
