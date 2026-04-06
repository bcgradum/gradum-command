import { db } from "./db";
import { sql } from "drizzle-orm";

export function runMigrations() {
  db.run(sql`CREATE TABLE IF NOT EXISTS facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_number INTEGER NOT NULL,
    location_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip TEXT NOT NULL,
    lat REAL,
    lng REAL,
    email TEXT,
    phone TEXT,
    ig_account TEXT,
    google_maps_link TEXT,
    hubspot_booking_link TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    lat REAL,
    lng REAL,
    has_baseball INTEGER DEFAULT 0,
    has_softball INTEGER DEFAULT 0,
    roster_url TEXT,
    last_scanned TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS facility_schools (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id INTEGER NOT NULL,
    school_id INTEGER NOT NULL,
    distance_miles REAL,
    zone TEXT
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS athletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    grad_year INTEGER,
    school_id INTEGER,
    school_name TEXT,
    travel_team TEXT,
    city TEXT,
    state TEXT,
    lat REAL,
    lng REAL,
    position TEXT,
    sport TEXT NOT NULL DEFAULT 'baseball',
    sources TEXT NOT NULL DEFAULT '[]',
    ig_status TEXT NOT NULL DEFAULT 'not_searched',
    ig_handle TEXT,
    ig_confidence INTEGER,
    ig_verification_notes TEXT,
    ig_source_strategy TEXT,
    nearest_facility_id INTEGER,
    nearest_ig_account TEXT,
    priority_score INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS facility_athletes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id INTEGER NOT NULL,
    athlete_id INTEGER NOT NULL,
    distance_miles REAL,
    zone TEXT,
    is_nearest INTEGER DEFAULT 0,
    added_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    facility_id INTEGER,
    message TEXT NOT NULL,
    details TEXT,
    count INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    assigned_facilities TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  console.log("Migrations complete.");
}
