import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import { runMigrations } from "./migrate";
import { matchIgHandle, startMaxPrepsRosterScrape, getApifyRunStatus, getApifyRunResults, discoverSchoolsNearFacility } from "./pipeline";
import { sbFacilities, sbAthletes, sbActivity, sbGetDashboardStats, sbGetFacilityStats, sbBookings, sbFollowups } from "./supabase";
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
    // Support both email and username login (username stored in email field)
    const user = storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid email or password" });
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });
    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ─── DASHBOARD ─────────────────────────────────────────────────────────────────────────────────────
  app.get("/api/dashboard", async (_req, res) => {
    try {
      const sbStats = await sbGetDashboardStats();
      // If Supabase has no athletes, fall back to SQLite
      if (sbStats.totalAthletes === 0) throw new Error("Supabase empty");
      res.json(sbStats);
    }
    catch { res.json(storage.getDashboardStats()); }
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
    const facilityId = Number(req.params.id);
    try {
      // Get base stats from Supabase or SQLite
      let baseStats: any;
      try {
        const sbStats = await sbGetFacilityStats(facilityId);
        if (sbStats.totalAthletes === 0) throw new Error("Supabase empty");
        baseStats = sbStats;
      } catch {
        baseStats = storage.getFacilityStats(facilityId);
      }

      // Get facility info for the location name lookup
      let facilityName = "";
      try {
        const facility = await sbFacilities.getById(facilityId);
        if (facility?.locationName) {
          facilityName = facility.locationName.replace("Gradum Gswing ", "").replace("Gradum ", "");
        }
      } catch {
        const facility = storage.getFacility(facilityId);
        if (facility?.locationName) {
          facilityName = facility.locationName.replace("Gradum Gswing ", "").replace("Gradum ", "");
        }
      }

      // Get booking stats for show rate / close rate
      let showRate = 0;
      let closeRate = 0;
      try {
        const Database = (await import("better-sqlite3")).default;
        const path = (await import("path")).default;
        const db = new Database(path.join(process.cwd(), "gradum.db"));
        const bookingStats = db.prepare(`
          SELECT 
            COUNT(*) as total_booked,
            SUM(CASE WHEN show_status = 'show' THEN 1 ELSE 0 END) as total_shows,
            SUM(CASE WHEN close_status = 'close' THEN 1 ELSE 0 END) as total_closes
          FROM bookings WHERE location = ?
        `).get(facilityName) as any;
        db.close();
        if (bookingStats) {
          showRate = bookingStats.total_booked > 0 ? Math.round((bookingStats.total_shows / bookingStats.total_booked) * 100) : 0;
          closeRate = bookingStats.total_shows > 0 ? Math.round((bookingStats.total_closes / bookingStats.total_shows) * 100) : 0;
        }
      } catch (e) {
        // Booking stats unavailable — return rates as 0
      }

      res.json({ ...baseStats, showRate, closeRate });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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
      const sbResult = await sbAthletes.getByFacility(facilityId, qsExtra);
      // If Supabase returned data use it, otherwise fall back to SQLite
      if (sbResult.length > 0) {
        const search = String(req.query.search || "").toLowerCase();
        const filtered = search
          ? sbResult.filter((a: any) =>
              a.fullName?.toLowerCase().includes(search) ||
              a.schoolName?.toLowerCase().includes(search) ||
              a.igHandle?.toLowerCase().includes(search))
          : sbResult;
        return res.json(filtered);
      }
      // Fall through to SQLite if Supabase is empty
      throw new Error("Supabase empty, using SQLite");
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
    const id = Number(req.params.id);
    const { handleStatus, ...rest } = req.body;
    try {
      // Map camelCase to snake_case for Supabase if needed
      const update: any = { ...rest };
      if (handleStatus !== undefined) update.handle_status = handleStatus;
      await sbAthletes.update(id, update);
    } catch { /* fallback to SQLite */ }
    // Always update SQLite
    const sqliteUpdate: any = { ...rest };
    if (handleStatus !== undefined) (sqliteUpdate as any).handleStatus = handleStatus;
    const updated = storage.updateAthleteIg(id, sqliteUpdate);
    res.json(updated || { id, ...req.body });
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
      storage.addActivity({ type: "school_scan", facilityId: facility.id, message: `Full athlete discovery started for ${facility.locationName}`, count: null });
      res.json(run);
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });


  // ─── BOOKINGS ────────────────────────────────────────────────────────────────
  app.get("/api/bookings", async (req, res) => {
    const location = req.query.location ? String(req.query.location) : undefined;
    try {
      res.json(await sbBookings.getAll(location));
    } catch {
      // SQLite fallback — use raw sqlite3 for proper parameterized queries
      const Database = (await import("better-sqlite3")).default;
      const path = (await import("path")).default;
      const sqliteDb = new Database(path.join(process.cwd(), "gradum.db"));
      const stmt = location
        ? sqliteDb.prepare("SELECT * FROM bookings WHERE location = ? ORDER BY date_booked DESC")
        : sqliteDb.prepare("SELECT * FROM bookings ORDER BY date_booked DESC");
      const rows = (location ? stmt.all(location) : stmt.all()) as any[];
      sqliteDb.close();
      res.json(rows.map((b: any) => ({
        id: b.id, location: b.location, dateBooked: b.date_booked,
        evalDate: b.eval_date, evalTime: b.eval_time, leadName: b.lead_name,
        igHandle: b.ig_handle, phone: b.phone, assignedRep: b.assigned_rep,
        showStatus: b.show_status, closeStatus: b.close_status, revenue: b.revenue,
        rescheduleDate: b.reschedule_date, rescheduleTime: b.reschedule_time,
        notes: b.notes, createdAt: b.created_at,
      })));
    }
  });

  app.post("/api/bookings", async (req, res) => {
    const { location, dateBooked, evalDate, evalTime, leadName, igHandle, phone, assignedRep, notes } = req.body;
    if (!location || !leadName) {
      return res.status(400).json({ error: "Missing required fields: location, leadName" });
    }
    const now = new Date().toISOString();
    const data = {
      location, date_booked: dateBooked || now.split("T")[0],
      eval_date: evalDate, eval_time: evalTime, lead_name: leadName,
      ig_handle: igHandle || null, phone: phone || null,
      assigned_rep: assignedRep || null, notes: notes || null,
      show_status: null, close_status: null, revenue: null,
      reschedule_date: null, reschedule_time: null,
    };
    try {
      const result = await sbBookings.insert(data);
      res.json(result);
    } catch {
      const { db } = await import("./db");
      const { sql: drizzleSql } = await import("drizzle-orm");
      db.run(drizzleSql`INSERT INTO bookings (location, date_booked, eval_date, eval_time, lead_name, ig_handle, phone, assigned_rep, notes, show_status, close_status, revenue, reschedule_date, reschedule_time) VALUES (${data.location}, ${data.date_booked}, ${data.eval_date}, ${data.eval_time}, ${data.lead_name}, ${data.ig_handle}, ${data.phone}, ${data.assigned_rep}, ${data.notes}, ${data.show_status}, ${data.close_status}, ${data.revenue}, ${data.reschedule_date}, ${data.reschedule_time})`);
      res.json({ ...data, id: Date.now() });
    }
  });

  app.patch("/api/bookings/:id", async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body;
    // Convert camelCase to snake_case for storage
    const snakeUpdates: Record<string, any> = {};
    if (updates.showStatus !== undefined) snakeUpdates.show_status = updates.showStatus;
    if (updates.closeStatus !== undefined) snakeUpdates.close_status = updates.closeStatus;
    if (updates.revenue !== undefined) snakeUpdates.revenue = updates.revenue;
    if (updates.rescheduleDate !== undefined) snakeUpdates.reschedule_date = updates.rescheduleDate;
    if (updates.rescheduleTime !== undefined) snakeUpdates.reschedule_time = updates.rescheduleTime;
    if (updates.notes !== undefined) snakeUpdates.notes = updates.notes;
    if (updates.assignedRep !== undefined) snakeUpdates.assigned_rep = updates.assignedRep;
    if (updates.location !== undefined) snakeUpdates.location = updates.location;
    if (updates.dateBooked !== undefined) snakeUpdates.date_booked = updates.dateBooked;
    if (updates.evalDate !== undefined) snakeUpdates.eval_date = updates.evalDate;
    if (updates.evalTime !== undefined) snakeUpdates.eval_time = updates.evalTime;
    if (updates.leadName !== undefined) snakeUpdates.lead_name = updates.leadName;
    if (updates.igHandle !== undefined) snakeUpdates.ig_handle = updates.igHandle;
    if (updates.phone !== undefined) snakeUpdates.phone = updates.phone;
    try {
      const result = await sbBookings.update(id, snakeUpdates);
      res.json(result);
    } catch {
      const Database = (await import("better-sqlite3")).default;
      const path = (await import("path")).default;
      const db = new Database(path.join(process.cwd(), "gradum.db"));
      const setClauses = Object.entries(snakeUpdates)
        .map(([k]) => `${k} = ?`)
        .join(", ");
      const values = Object.values(snakeUpdates);
      if (setClauses) {
        db.prepare(`UPDATE bookings SET ${setClauses} WHERE id = ?`).run(...values, id);
      }
      db.close();
      res.json({ id, ...updates });
    }
  });

  // ─── FOLLOW-UPS ──────────────────────────────────────────────────────────────
  app.get("/api/followups", async (req, res) => {
    const location = req.query.location ? String(req.query.location) : undefined;
    try {
      res.json(await sbFollowups.getAll(location));
    } catch {
      const { db } = await import("./db");
      const { sql: drizzleSql } = await import("drizzle-orm");
      let query = "SELECT * FROM followups";
      const params: any[] = [];
      if (location) { query += " WHERE location = ?"; params.push(location); }
      query += " ORDER BY created_at DESC";
      const rows = db.all(drizzleSql.raw(query)) as any[];
      res.json(rows.map((f: any) => ({
        id: f.id, location: f.location, date: f.date,
        igUsername: f.ig_username, assignedRep: f.assigned_rep,
        notes: f.notes, status: f.status, createdAt: f.created_at,
      })));
    }
  });

  app.post("/api/followups", async (req, res) => {
    const { location, igUsername, assignedRep, notes, status } = req.body;
    if (!location || !igUsername) {
      return res.status(400).json({ error: "Missing required fields: location, igUsername" });
    }
    const now = new Date().toISOString();
    const data = {
      location, date: now.split("T")[0],
      ig_username: igUsername, assigned_rep: assignedRep || null,
      notes: notes || null, status: status || "active",
    };
    try {
      const result = await sbFollowups.insert(data);
      res.json(result);
    } catch {
      const { db } = await import("./db");
      const { sql: drizzleSql } = await import("drizzle-orm");
      db.run(drizzleSql`INSERT INTO followups (location, date, ig_username, assigned_rep, notes, status) VALUES (${data.location}, ${data.date}, ${data.ig_username}, ${data.assigned_rep}, ${data.notes}, ${data.status})`);
      res.json({ ...data, id: Date.now() });
    }
  });

  app.patch("/api/followups/:id", async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body;
    const snakeUpdates: Record<string, any> = {};
    if (updates.status !== undefined) snakeUpdates.status = updates.status;
    if (updates.notes !== undefined) snakeUpdates.notes = updates.notes;
    if (updates.assignedRep !== undefined) snakeUpdates.assigned_rep = updates.assignedRep;
    if (updates.location !== undefined) snakeUpdates.location = updates.location;
    if (updates.igUsername !== undefined) snakeUpdates.ig_username = updates.igUsername;
    try {
      const result = await sbFollowups.update(id, snakeUpdates);
      res.json(result);
    } catch {
      const { db } = await import("./db");
      const { sql: drizzleSql } = await import("drizzle-orm");
      const setClauses = Object.entries(snakeUpdates).map(([k, v]) => `${k} = '${v}'`).join(", ");
      if (setClauses) {
        db.run(drizzleSql.raw(`UPDATE followups SET ${setClauses} WHERE id = ${id}`));
      }
      res.json({ id, ...updates });
    }
  });

  // ─── SALES STATS ─────────────────────────────────────────────────────────────
  app.get("/api/sales/stats", async (req, res) => {
    const period = String(req.query.period || "all");
    try {
      // Fetch all bookings from Supabase
      let allBookings: any[];
      try {
        allBookings = await sbBookings.getAll();
      } catch {
        // SQLite fallback
        const { db } = await import("./db");
        const { sql: drizzleSql } = await import("drizzle-orm");
        const Database2 = (await import("better-sqlite3")).default;
        const path2 = (await import("path")).default;
        const sqliteDb2 = new Database2(path2.join(process.cwd(), "gradum.db"));
        const rawRows = sqliteDb2.prepare("SELECT * FROM bookings ORDER BY date_booked DESC").all() as any[];
        sqliteDb2.close();
        allBookings = rawRows.map((b: any) => ({
          id: b.id, location: b.location, dateBooked: b.date_booked,
          evalDate: b.eval_date, showStatus: b.show_status, closeStatus: b.close_status,
          revenue: b.revenue, notes: b.notes, createdAt: b.created_at,
        }));
      }

      // Period filter — use dateBooked (actual eval date) not createdAt
      const now = new Date();
      const nowStr = now.toISOString().split("T")[0];
      const filtered = allBookings.filter((b: any) => {
        const rawDate = b.dateBooked || b.date_booked || "";
        if (!rawDate) return period === "all"; // no date = only show in all-time
        // Parse M/D/YYYY format
        let bookingDate: Date;
        try {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            bookingDate = new Date(`${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`);
          } else {
            bookingDate = new Date(rawDate);
          }
          if (isNaN(bookingDate.getTime())) return period === "all";
        } catch { return period === "all"; }
        if (period === "day") {
          return bookingDate.toDateString() === now.toDateString();
        } else if (period === "week") {
          return (now.getTime() - bookingDate.getTime()) <= 7 * 24 * 60 * 60 * 1000;
        } else if (period === "month") {
          return (now.getTime() - bookingDate.getTime()) <= 30 * 24 * 60 * 60 * 1000;
        }
        return true; // all
      });

      // Helper: determine display status
      const todayStr = new Date().toISOString().split("T")[0];
      const getDisplayStatus = (b: any) => {
        if (b.showStatus) return b.showStatus;
        const notes = b.notes || b.computedStatus || "";
        if (notes === "tba") return "tba";
        if (notes === "pending") return "pending";
        // Derive from date
        const evalDate = b.evalDate || b.dateBooked || "";
        if (evalDate) {
          const parts = evalDate.split("/");
          if (parts.length === 3) {
            const iso = `${parts[2]}-${parts[0].padStart(2,"0")}-${parts[1].padStart(2,"0")}`;
            return iso > todayStr ? "tba" : "pending";
          }
        }
        return "pending";
      };

      // Aggregate totals
      const total_booked = filtered.length;
      const shows = filtered.filter((b: any) => b.showStatus === "show").length;
      const closes = filtered.filter((b: any) => b.closeStatus === "close").length;
      const no_sales = filtered.filter((b: any) => b.closeStatus === "no_sale").length;
      const reschedules = filtered.filter((b: any) => b.showStatus === "reschedule").length;
      const cancels = filtered.filter((b: any) => b.showStatus === "cancel" || b.showStatus === "no_show").length;
      const revenue = filtered.reduce((sum: number, b: any) => sum + (parseFloat(b.revenue) || 0), 0);
      const tba = filtered.filter((b: any) => getDisplayStatus(b) === "tba").length;
      const pending = filtered.filter((b: any) => getDisplayStatus(b) === "pending").length;

      // By location
      const locationMap: Record<string, any> = {};
      filtered.forEach((b: any) => {
        const loc = b.location || "Unknown";
        if (!locationMap[loc]) {
          locationMap[loc] = { location: loc, booked: 0, shows: 0, closes: 0, no_sales: 0, reschedules: 0, cancels: 0, revenue: 0, tba: 0, pending: 0 };
        }
        locationMap[loc].booked++;
        if (b.showStatus === "show") locationMap[loc].shows++;
        if (b.closeStatus === "close") locationMap[loc].closes++;
        if (b.closeStatus === "no_sale") locationMap[loc].no_sales++;
        if (b.showStatus === "reschedule") locationMap[loc].reschedules++;
        if (b.showStatus === "cancel" || b.showStatus === "no_show") locationMap[loc].cancels++;
        locationMap[loc].revenue += parseFloat(b.revenue) || 0;
        const ds = getDisplayStatus(b);
        if (ds === "tba") locationMap[loc].tba++;
        if (ds === "pending") locationMap[loc].pending++;
      });

      const by_location = Object.values(locationMap).sort((a: any, b: any) => b.revenue - a.revenue);

      res.json({ total_booked, shows, closes, no_sales, reschedules, cancels, revenue, tba, pending, by_location });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── REP STATS ───────────────────────────────────────────────────────────────
  app.get("/api/sales/rep-stats", async (req, res) => {
    try {
      const Database = (await import("better-sqlite3")).default;
      const path = (await import("path")).default;
      const db = new Database(path.join(process.cwd(), "gradum.db"));
      const rows = db.prepare(`
        SELECT 
          assigned_rep,
          COUNT(*) as booked,
          SUM(CASE WHEN show_status = 'show' THEN 1 ELSE 0 END) as shows,
          SUM(CASE WHEN close_status = 'close' THEN 1 ELSE 0 END) as closes,
          SUM(CASE WHEN close_status = 'no_sale' THEN 1 ELSE 0 END) as no_sales,
          SUM(CASE WHEN show_status = 'no_show' OR show_status = 'cancel' THEN 1 ELSE 0 END) as cancels,
          SUM(CASE WHEN revenue IS NOT NULL THEN revenue ELSE 0 END) as revenue
        FROM bookings
        WHERE assigned_rep IS NOT NULL AND assigned_rep != ''
        GROUP BY assigned_rep
        ORDER BY booked DESC
      `).all() as any[];
      db.close();
      res.json(rows.map(r => ({
        rep: r.assigned_rep,
        booked: r.booked,
        shows: r.shows,
        closes: r.closes,
        noSales: r.no_sales,
        cancels: r.cancels,
        revenue: parseFloat(r.revenue) || 0,
        showRate: r.booked > 0 ? Math.round((r.shows / r.booked) * 100) : 0,
        closeRate: r.shows > 0 ? Math.round((r.closes / r.shows) * 100) : 0,
      })));
    } catch(err: any) { res.status(500).json({ error: err.message }); }
  });

  const httpServer = createServer(app);
  return httpServer;
}
