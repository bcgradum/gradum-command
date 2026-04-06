import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { runMigrations } from "./migrate";
import { matchIgHandle, startMaxPrepsRosterScrape, getApifyRunStatus, getApifyRunResults, discoverSchoolsNearFacility } from "./pipeline";
import { sbFacilities, sbAthletes, sbActivity, sbGetDashboardStats, sbGetFacilityStats } from "./supabase";
import { seedSupabase } from "./supabase-seed";
import bcrypt from "bcryptjs";

export async function registerRoutes(app: Express): Promise<Server> {
  runMigrations();
  await seedDatabase();
  await seedSupabase(); // Also seed Supabase (skips if already seeded)

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });
    const user = storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/dashboard", async (_req, res) => {
    try { res.json(await sbGetDashboardStats()); }
    catch { res.json(storage.getDashboardStats()); } // fallback to SQLite
  });

  // ─── FACILITIES ──────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/facilities", async (_req, res) => {
    try { res.json(await sbFacilities.getAll()); }
    catch { res.json(storage.getFacilities()); }
  });

  app.get("/api/facilities/:id", async (req, res) => {
    try {
      const facility = await sbFacilities.getById(Number(req.params.id));
      if (!facility) return res.status(404).json({ error: "Not found" });
      res.json(facility);
    } catch {
      const facility = storage.getFacility(Number(req.params.id));
      if (!facility) return res.status(404).json({ error: "Not found" });
      res.json(facility);
    }
  });

  app.get("/api/facilities/:id/stats", async (req, res) => {
    try { res.json(await sbGetFacilityStats(Number(req.params.id))); }
    catch { res.json(storage.getFacilityStats(Number(req.params.id))); }
  });

  app.get("/api/facilities/:id/activity", async (req, res) => {
    try { res.json(await sbActivity.getRecent(Number(req.params.id), 30)); }
    catch { res.json(storage.getActivityLog(Number(req.params.id), 30)); }
  });

  app.get("/api/facilities/:id/schools", (req, res) => {
    res.json(storage.getSchoolsByFacility(Number(req.params.id)));
  });

  // ─── ATHLETES ────────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/facilities/:id/athletes", async (req, res) => {
    const facilityId = Number(req.params.id);
    const sbFilters: Record<string, string> = {};
    if (req.query.sport) sbFilters["sport=eq."] = String(req.query.sport);
    if (req.query.igStatus) sbFilters["ig_status=eq."] = String(req.query.igStatus);
    if (req.query.minConfidence) sbFilters["ig_confidence=gte."] = String(req.query.minConfidence);
    if (req.query.maxConfidence) sbFilters["ig_confidence=lte."] = String(req.query.maxConfidence);
    try {
      // Build Supabase query params
      let qsExtra = "";
      if (req.query.sport) qsExtra += `&sport=eq.${req.query.sport}`;
      if (req.query.igStatus) qsExtra += `&ig_status=eq.${req.query.igStatus}`;
      if (req.query.minConfidence) qsExtra += `&ig_confidence=gte.${req.query.minConfidence}`;
      if (req.query.maxConfidence) qsExtra += `&ig_confidence=lte.${req.query.maxConfidence}`;
      if (req.query.gradYear) qsExtra += `&grad_year=eq.${req.query.gradYear}`;
      const athletes = await sbAthletes.getByFacility(facilityId, qsExtra);
      // Apply text search client-side if needed
      const search = String(req.query.search || "").toLowerCase();
      const filtered = search
        ? athletes.filter((a: any) =>
            a.full_name?.toLowerCase().includes(search) ||
            a.school_name?.toLowerCase().includes(search) ||
            a.ig_handle?.toLowerCase().includes(search))
        : athletes;
      res.json(filtered);
    } catch {
      const localFilters: any = {};
      if (req.query.sport) localFilters.sport = req.query.sport;
      if (req.query.gradYear) localFilters.gradYear = Number(req.query.gradYear);
      if (req.query.igStatus) localFilters.igStatus = req.query.igStatus;
      if (req.query.search) localFilters.search = req.query.search;
      if (req.query.minConfidence) localFilters.minConfidence = Number(req.query.minConfidence);
      if (req.query.maxConfidence) localFilters.maxConfidence = Number(req.query.maxConfidence);
      res.json(storage.getAthletesByFacility(facilityId, localFilters));
    }
  });

  app.patch("/api/athletes/:id/ig", async (req, res) => {
    try {
      await sbAthletes.update(Number(req.params.id), req.body);
      res.json({ id: Number(req.params.id), ...req.body });
    } catch {
      const updated = storage.updateAthleteIg(Number(req.params.id), req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    }
  });

  // ─── ACTIVITY LOG ───────────────────────────────────────────────────────────────────────────────────
  app.get("/api/activity", async (_req, res) => {
    try { res.json(await sbActivity.getRecent(undefined, 50)); }
    catch { res.json(storage.getActivityLog(undefined, 50)); }
  });

  // ─── IG MATCHING (Claude API) ──────────────────────────────────────────────
  app.post("/api/pipeline/ig-match/:athleteId", async (req, res) => {
    const athlete = await storage.getAllAthletes().find(a => a.id === Number(req.params.athleteId));
    if (!athlete) return res.status(404).json({ error: "Athlete not found" });
    try {
      const result = await matchIgHandle({
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gradYear: athlete.gradYear,
        schoolName: athlete.schoolName,
        travelTeam: athlete.travelTeam,
        city: athlete.city,
        state: athlete.state,
        position: athlete.position,
        sport: athlete.sport,
      });
      // Save result to Supabase + SQLite fallback
      const igUpdate = {
        ig_handle: result.handle, ig_confidence: result.confidence,
        ig_status: result.status, ig_verification_notes: result.reasoning, ig_source_strategy: result.strategy,
      };
      try { await sbAthletes.update(athlete.id, igUpdate); } catch {}
      const updated = storage.updateAthleteIg(athlete.id, {
        igHandle: result.handle || undefined, igConfidence: result.confidence,
        igStatus: result.status, igVerificationNotes: result.reasoning, igSourceStrategy: result.strategy,
      });
      const activityEntry = {
        type: "ig_match", facility_id: athlete.nearestFacilityId,
        message: `IG match: ${athlete.fullName} → ${result.handle ? '@' + result.handle : 'Not found'}`,
        details: result.reasoning, count: result.confidence,
      };
      try { await sbActivity.insert(activityEntry); } catch {}
      storage.addActivity({ type: "ig_match", facilityId: athlete.nearestFacilityId, message: activityEntry.message, details: result.reasoning, count: result.confidence });
      res.json({ result, athlete: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Batch IG matching for a facility
  app.post("/api/pipeline/ig-match-batch/:facilityId", async (req, res) => {
    const facilityId = Number(req.params.facilityId);
    const athletes = storage.getAthletesByFacility(facilityId, { igStatus: "not_searched" });
    const limit = Math.min(athletes.length, Number(req.query.limit) || 10);
    res.json({ queued: limit, total: athletes.length, athletes: athletes.slice(0, limit).map(a => a.id) });
    
    // Process in background
    (async () => {
      let matched = 0;
      for (const athlete of athletes.slice(0, limit)) {
        try {
          const result = await matchIgHandle({
            firstName: athlete.firstName, lastName: athlete.lastName,
            gradYear: athlete.gradYear, schoolName: athlete.schoolName,
            travelTeam: athlete.travelTeam, city: athlete.city,
            state: athlete.state, position: athlete.position, sport: athlete.sport,
          });
          storage.updateAthleteIg(athlete.id, {
            igHandle: result.handle || undefined, igConfidence: result.confidence,
            igStatus: result.status, igVerificationNotes: result.reasoning, igSourceStrategy: result.strategy,
          });
          if (result.handle) matched++;
          await new Promise(r => setTimeout(r, 500)); // rate limit
        } catch(e) { console.error(e); }
      }
      storage.addActivity({
        type: "ig_match", facilityId,
        message: `IG batch match complete — ${matched}/${limit} handles found`,
        count: matched,
      });
    })();
  });

  // ─── APIFY ROSTER COLLECTION ─────────────────────────────────────────────────
  app.post("/api/pipeline/scrape-roster", async (req, res) => {
    const { schoolName, city, state, sport } = req.body;
    if (!schoolName || !city || !state) return res.status(400).json({ error: "schoolName, city, state required" });
    try {
      const run = await startMaxPrepsRosterScrape(schoolName, city, state, sport || "baseball");
      res.json(run);
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Check Apify run status
  app.get("/api/pipeline/run/:runId", async (req, res) => {
    try {
      const status = await getApifyRunStatus(req.params.runId);
      res.json(status);
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // Get Apify results and save to DB
  app.post("/api/pipeline/import-results/:runId/:facilityId", async (req, res) => {
    const facilityId = Number(req.params.facilityId);
    try {
      const status = await getApifyRunStatus(req.params.runId);
      if (!status.datasetId) return res.status(400).json({ error: "Run not complete" });
      const items = await getApifyRunResults(status.datasetId);
      let imported = 0;
      for (const item of items) {
        if (!item.name || typeof item.name !== "string") continue;
        const parts = item.name.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const firstName = parts[0];
        const lastName = parts.slice(1).join(" ");
        const athlete = storage.createAthlete({
          firstName, lastName, fullName: item.name,
          gradYear: item.gradYear || null, schoolName: item.school || null,
          city: item.city || null, state: item.state || null,
          position: item.position || null, sport: item.sport || "baseball",
          sources: JSON.stringify([item.source || "Apify"]),
          igStatus: "not_searched", nearestFacilityId: facilityId,
          nearestIgAccount: null, priorityScore: 70,
        });
        imported++;
      }
      storage.addActivity({ type: "roster_pull", facilityId, message: `Imported ${imported} athletes from Apify run`, count: imported });
      res.json({ imported, total: items.length });
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── SCHOOL DISCOVERY ────────────────────────────────────────────────────────
  app.post("/api/pipeline/discover-schools/:facilityId", async (req, res) => {
    const facility = storage.getFacility(Number(req.params.facilityId));
    if (!facility || !facility.lat || !facility.lng) return res.status(404).json({ error: "Facility not found or no coordinates" });
    try {
      const run = await discoverSchoolsNearFacility(facility.locationName, facility.lat, facility.lng);
      storage.addActivity({ type: "school_scan", facilityId: facility.id, message: `School discovery started for ${facility.locationName}`, count: null });
      res.json(run);
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  const httpServer = createServer(app);
  return httpServer;
}
