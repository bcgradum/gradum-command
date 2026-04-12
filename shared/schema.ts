import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── FACILITIES ───────────────────────────────────────────────────────────────
export const facilities = sqliteTable("facilities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityNumber: integer("facility_number").notNull(),
  locationName: text("location_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zip: text("zip").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  email: text("email"),
  phone: text("phone"),
  igAccount: text("ig_account"),
  googleMapsLink: text("google_maps_link"),
  hubspotBookingLink: text("hubspot_booking_link"),
  status: text("status").notNull().default("active"), // active | parked
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── SCHOOLS ─────────────────────────────────────────────────────────────────
export const schools = sqliteTable("schools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  lat: real("lat"),
  lng: real("lng"),
  hasBaseball: integer("has_baseball").default(0),
  hasSoftball: integer("has_softball").default(0),
  rosterUrl: text("roster_url"),
  lastScanned: text("last_scanned"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── FACILITY-SCHOOL MAP ──────────────────────────────────────────────────────
export const facilitySchools = sqliteTable("facility_schools", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull(),
  schoolId: integer("school_id").notNull(),
  distanceMiles: real("distance_miles"),
  zone: text("zone"), // primary | secondary | extended
});

// ─── ATHLETES ─────────────────────────────────────────────────────────────────
export const athletes = sqliteTable("athletes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  fullName: text("full_name").notNull(),
  gradYear: integer("grad_year"),
  schoolId: integer("school_id"),
  schoolName: text("school_name"),
  travelTeam: text("travel_team"),
  city: text("city"),
  state: text("state"),
  lat: real("lat"),
  lng: real("lng"),
  position: text("position"),
  sport: text("sport").notNull().default("baseball"), // baseball | softball
  sources: text("sources").notNull().default("[]"), // JSON array of source names
  igStatus: text("ig_status").notNull().default("not_searched"), // not_searched | matched | low_confidence | review | not_found
  igHandle: text("ig_handle"),
  igConfidence: integer("ig_confidence"),
  igVerificationNotes: text("ig_verification_notes"),
  igSourceStrategy: text("ig_source_strategy"),
  nearestFacilityId: integer("nearest_facility_id"),
  nearestIgAccount: text("nearest_ig_account"),
  priorityScore: integer("priority_score").default(0),
  handleStatus: text("handle_status"), // confirmed | wrong
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

// ─── FACILITY-ATHLETE MAP ─────────────────────────────────────────────────────
export const facilityAthletes = sqliteTable("facility_athletes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  facilityId: integer("facility_id").notNull(),
  athleteId: integer("athlete_id").notNull(),
  distanceMiles: real("distance_miles"),
  zone: text("zone"), // primary | secondary | extended
  isNearest: integer("is_nearest").default(0),
  addedAt: text("added_at").notNull().default(new Date().toISOString()),
});

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export const activityLog = sqliteTable("activity_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(), // school_scan | roster_pull | ig_match | system | error
  facilityId: integer("facility_id"),
  message: text("message").notNull(),
  details: text("details"),
  count: integer("count"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── USERS ────────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("staff"), // admin | staff
  assignedFacilities: text("assigned_facilities").notNull().default("[]"), // JSON array of facility IDs
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

// ─── INSERT SCHEMAS ───────────────────────────────────────────────────────────
export const insertFacilitySchema = createInsertSchema(facilities).omit({ id: true, createdAt: true });
export const insertSchoolSchema = createInsertSchema(schools).omit({ id: true, createdAt: true });
export const insertAthleteSchema = createInsertSchema(athletes).omit({ id: true, createdAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activityLog).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

// ─── TYPES ────────────────────────────────────────────────────────────────────
export type Facility = typeof facilities.$inferSelect;
export type School = typeof schools.$inferSelect;
export type Athlete = typeof athletes.$inferSelect;
export type FacilityAthlete = typeof facilityAthletes.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type User = typeof users.$inferSelect;

export type InsertFacility = z.infer<typeof insertFacilitySchema>;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type InsertAthlete = z.infer<typeof insertAthleteSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
