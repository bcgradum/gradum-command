import { db } from "./db";
import { facilities, activityLog, athletes, facilityAthletes, schools, facilitySchools, users } from "@shared/schema";
import { count } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

const FACILITIES_DATA = [
  { facilityNumber: 2, locationName: "Gradum Austin", address: "720 S Bell Boulevard, #6C, Cedar Park, TX 78613", city: "Cedar Park", state: "TX", zip: "78613", email: "austin@gradumgswing.com", phone: "(512) 643-6303", igAccount: "@gradumaustin", lat: 30.50231, lng: -97.81757, status: "active" },
  { facilityNumber: 3, locationName: "Gradum Broward", address: "1850 NW 15th Avenue, Suite 125, Pompano Beach, FL 33069", city: "Pompano Beach", state: "FL", zip: "33069", email: "broward@gradumgswing.com", phone: "(954) 242-2954", igAccount: "@gradumbroward", lat: 26.253743, lng: -80.143669, status: "active" },
  { facilityNumber: 4, locationName: "Gradum Carrollton", address: "2520 Tarpley Road, Suite 100, Carrollton, TX 75006", city: "Carrollton", state: "TX", zip: "75006", email: "carrollton@gradumgswing.com", phone: "(972) 440-9594", igAccount: "@gradumdallas", lat: 32.983189, lng: -96.85134, status: "active" },
  { facilityNumber: 5, locationName: "Gradum Cary", address: "Cary, NC", city: "Cary", state: "NC", zip: "27511", email: "cary@gradumgswing.com", phone: "", igAccount: "@Gradumraleigh", lat: 35.795282, lng: -78.801712, status: "active" },
  { facilityNumber: 6, locationName: "Gradum Charleston", address: "Mount Pleasant, SC", city: "Mount Pleasant", state: "SC", zip: "29464", email: "charleston@gradumgswing.com", phone: "", igAccount: "@gradumcharleston", lat: 32.883446, lng: -79.761203, status: "active" },
  { facilityNumber: 7, locationName: "Gradum Charlotte", address: "Cornelius, NC", city: "Cornelius", state: "NC", zip: "28031", email: "charlotte@gradumgswing.com", phone: "", igAccount: "@GradumCharlotte", lat: 35.481705, lng: -80.859001, status: "active" },
  { facilityNumber: 9, locationName: "Gradum Fort Myers", address: "Fort Myers, FL", city: "Fort Myers", state: "FL", zip: "33901", email: "fortmyers@gradumgswing.com", phone: "", igAccount: "@Gradumftmyers", lat: 26.640628, lng: -81.872308, status: "active" },
  { facilityNumber: 10, locationName: "Gradum Fort Worth", address: "Fort Worth, TX", city: "Fort Worth", state: "TX", zip: "76101", email: "fortworth@gradumgswing.com", phone: "", igAccount: "@gradumfortworth", lat: 32.90964, lng: -97.258165, status: "active" },
  { facilityNumber: 11, locationName: "Gradum Frisco", address: "Little Elm, TX", city: "Little Elm", state: "TX", zip: "75068", email: "frisco@gradumgswing.com", phone: "", igAccount: "@gradumdallas", lat: 33.154615, lng: -96.907788, status: "active" },
  { facilityNumber: 12, locationName: "Gradum Houston", address: "Houston, TX", city: "Houston", state: "TX", zip: "77001", email: "houston@gradumgswing.com", phone: "", igAccount: "@Gradumhouston", lat: 29.834678, lng: -95.569881, status: "active" },
  { facilityNumber: 13, locationName: "Gradum Jacksonville", address: "Jacksonville, FL", city: "Jacksonville", state: "FL", zip: "32099", email: "jacksonville@gradumgswing.com", phone: "", igAccount: "@gradumjacksonville", lat: 30.281224, lng: -81.506431, status: "active" },
  { facilityNumber: 14, locationName: "Gradum Jupiter", address: "Jupiter, FL", city: "Jupiter", state: "FL", zip: "33458", email: "jupiter@gradumgswing.com", phone: "", igAccount: "@Gradumjupiter", lat: 26.924611, lng: -80.143698, status: "active" },
  { facilityNumber: 16, locationName: "Gradum Nocatee", address: "St. Augustine, FL", city: "St. Augustine", state: "FL", zip: "32095", email: "nocatee@gradumgswing.com", phone: "", igAccount: "@gradumnocatee", lat: 29.894695, lng: -81.314539, status: "active" },
  { facilityNumber: 17, locationName: "Gradum Orlando", address: "Orlando, FL", city: "Orlando", state: "FL", zip: "32801", email: "orlando@gradumgswing.com", phone: "", igAccount: "@Gradumwintergarden", lat: 28.542122, lng: -81.379045, status: "active" },
  { facilityNumber: 18, locationName: "Gradum Port St. Lucie", address: "Port St. Lucie, FL", city: "Port St. Lucie", state: "FL", zip: "34984", email: "portstlucie@gradumgswing.com", phone: "", igAccount: "@Gradumportstlucie", lat: 27.293933, lng: -80.350328, status: "active" },
  { facilityNumber: 20, locationName: "Gradum San Antonio", address: "San Antonio, TX", city: "San Antonio", state: "TX", zip: "78201", email: "sanantonio@gradumgswing.com", phone: "", igAccount: null, lat: 29.584373, lng: -98.582663, status: "parked" },
  { facilityNumber: 22, locationName: "Gradum South Charlotte", address: "Charlotte, NC", city: "Charlotte", state: "NC", zip: "28201", email: "southcharlotte@gradumgswing.com", phone: "", igAccount: "@Gradumsouthcharlotte", lat: 35.123514, lng: -80.954087, status: "active" },
  { facilityNumber: 23, locationName: "Gradum South Miami", address: "Miami, FL", city: "Miami", state: "FL", zip: "33101", email: "southmiami@gradumgswing.com", phone: "", igAccount: "@Gradumsouthmiami", lat: 25.774157, lng: -80.193597, status: "active" },
  { facilityNumber: 24, locationName: "Gradum Spring", address: "Spring, TX", city: "Spring", state: "TX", zip: "77373", email: "spring@gradumgswing.com", phone: "", igAccount: "@Gradumhouston", lat: 30.079571, lng: -95.418792, status: "active" },
  { facilityNumber: 25, locationName: "Gradum Tampa", address: "Valrico, FL", city: "Valrico", state: "FL", zip: "33596", email: "tampa@gradumgswing.com", phone: "", igAccount: "@Gradumtampa", lat: 27.937834, lng: -82.232753, status: "active" },
  { facilityNumber: 26, locationName: "Gradum Wake Forest", address: "Wake Forest, NC", city: "Wake Forest", state: "NC", zip: "27587", email: "wakeforest@gradumgswing.com", phone: "", igAccount: "@Gradumraleigh", lat: 35.929534, lng: -78.535998, status: "active" },
  { facilityNumber: 27, locationName: "Gradum Wesley Chapel", address: "Lutz, FL", city: "Lutz", state: "FL", zip: "33549", email: "wesleychapel@gradumgswing.com", phone: "", igAccount: "@Gradumtampa", lat: 28.151124, lng: -82.461483, status: "active" },
  // Parked facilities
  { facilityNumber: 1, locationName: "Gradum Alpharetta", address: "2723 Pine Grove Road, Unit 1, Alpharetta, GA 30005", city: "Alpharetta", state: "GA", zip: "30005", email: "alpharetta@gradumgswing.com", phone: "(770) 628-5017", igAccount: null, lat: 34.075596, lng: -84.294596, status: "parked" },
  { facilityNumber: 8, locationName: "Gradum Edmond", address: "Edmond, OK", city: "Edmond", state: "OK", zip: "73003", email: "edmonds@gradumgswing.com", phone: "", igAccount: null, lat: 35.657137, lng: -97.464904, status: "parked" },
  { facilityNumber: 15, locationName: "Gradum McKinney", address: "McKinney, TX", city: "McKinney", state: "TX", zip: "75069", email: "mckinney@gradumgswing.com", phone: "", igAccount: null, lat: 33.230648, lng: -96.612495, status: "parked" },
  { facilityNumber: 19, locationName: "Gradum Salt Lake City", address: "South Jordan, UT", city: "South Jordan", state: "UT", zip: "84095", email: "saltlakecity@gradumgswing.com", phone: "", igAccount: null, lat: 40.557587, lng: -111.93869, status: "parked" },
  { facilityNumber: 21, locationName: "Gradum Sarasota", address: "Sarasota, FL", city: "Sarasota", state: "FL", zip: "34230", email: "sarasota@gradumgswing.com", phone: "", igAccount: null, lat: 27.336581, lng: -82.530855, status: "parked" },
];

const SAMPLE_ATHLETES = [
  { firstName: "Mason", lastName: "Rodriguez", fullName: "Mason Rodriguez", gradYear: 2027, schoolName: "Klein Oak HS", city: "Spring", state: "TX", position: "RHP", sport: "baseball", sources: '["perfectgame","maxpreps"]', igStatus: "matched", igHandle: "mason_rod27", igConfidence: 92, nearestFacilityId: 0, nearestIgAccount: "@Gradumhouston", priorityScore: 95 },
  { firstName: "Jake", lastName: "Williams", fullName: "Jake Williams", gradYear: 2028, schoolName: "Broward County HS", city: "Pompano Beach", state: "FL", position: "SS", sport: "baseball", sources: '["hsbn","pbr"]', igStatus: "matched", igHandle: "jakew_ss28", igConfidence: 85, nearestFacilityId: 0, nearestIgAccount: "@gradumbroward", priorityScore: 88 },
  { firstName: "Tyler", lastName: "Johnson", fullName: "Tyler Johnson", gradYear: 2026, schoolName: "Klein Oak HS", city: "Spring", state: "TX", position: "C", sport: "baseball", sources: '["perfectgame"]', igStatus: "matched", igHandle: "tj_catches26", igConfidence: 78, nearestFacilityId: 0, nearestIgAccount: "@Gradumhouston", priorityScore: 72 },
  { firstName: "Carlos", lastName: "Martinez", fullName: "Carlos Martinez", gradYear: 2029, schoolName: "Coral Springs HS", city: "Coral Springs", state: "FL", position: "LHP", sport: "baseball", sources: '["usssa","gamechanger"]', igStatus: "low_confidence", igHandle: "cmart_baseball", igConfidence: 55, nearestFacilityId: 0, nearestIgAccount: "@gradumbroward", priorityScore: 65 },
  { firstName: "Sophia", lastName: "Davis", fullName: "Sophia Davis", gradYear: 2027, schoolName: "Jupiter HS", city: "Jupiter", state: "FL", position: "P", sport: "softball", sources: '["pgf","extrainnings"]', igStatus: "matched", igHandle: "sophia_fastpitch27", igConfidence: 90, nearestFacilityId: 0, nearestIgAccount: "@Gradumjupiter", priorityScore: 90 },
  { firstName: "Emma", lastName: "Thompson", fullName: "Emma Thompson", gradYear: 2028, schoolName: "Charlotte HS", city: "Cornelius", state: "NC", position: "SS", sport: "softball", sources: '["softballfactory"]', igStatus: "matched", igHandle: "emma_slapper", igConfidence: 82, nearestFacilityId: 0, nearestIgAccount: "@GradumCharlotte", priorityScore: 83 },
  { firstName: "Aiden", lastName: "Chen", fullName: "Aiden Chen", gradYear: 2030, schoolName: "Klein Collins HS", city: "Spring", state: "TX", position: "OF", sport: "baseball", sources: '["gamechanger"]', igStatus: "not_searched", igHandle: null, igConfidence: null, nearestFacilityId: 0, nearestIgAccount: "@Gradumhouston", priorityScore: 45 },
  { firstName: "Marcus", lastName: "Brown", fullName: "Marcus Brown", gradYear: 2027, schoolName: "Mount Pleasant HS", city: "Mount Pleasant", state: "SC", position: "3B", sport: "baseball", sources: '["perfectgame","pbr"]', igStatus: "review", igHandle: "mbrown_baseball", igConfidence: 48, nearestFacilityId: 0, nearestIgAccount: "@gradumcharleston", priorityScore: 80 },
  { firstName: "Isabella", lastName: "Garcia", fullName: "Isabella Garcia", gradYear: 2026, schoolName: "Cary HS", city: "Cary", state: "NC", position: "C", sport: "softball", sources: '["ncsa","fieldlevel"]', igStatus: "matched", igHandle: "bella_garcia_c", igConfidence: 95, nearestFacilityId: 0, nearestIgAccount: "@Gradumraleigh", priorityScore: 70 },
  { firstName: "Noah", lastName: "Wilson", fullName: "Noah Wilson", gradYear: 2028, schoolName: "Jupiter HS", city: "Jupiter", state: "FL", position: "2B", sport: "baseball", sources: '["maxpreps","perfectgame"]', igStatus: "not_found", igHandle: null, igConfidence: null, nearestFacilityId: 0, nearestIgAccount: "@Gradumjupiter", priorityScore: 78 },
  { firstName: "Olivia", lastName: "Lee", fullName: "Olivia Lee", gradYear: 2029, schoolName: "Wake Forest HS", city: "Wake Forest", state: "NC", position: "OF", sport: "softball", sources: '["usssa"]', igStatus: "matched", igHandle: "liv_lee29", igConfidence: 71, nearestFacilityId: 0, nearestIgAccount: "@Gradumraleigh", priorityScore: 60 },
  { firstName: "Dylan", lastName: "Scott", fullName: "Dylan Scott", gradYear: 2027, schoolName: "Port St. Lucie HS", city: "Port St. Lucie", state: "FL", position: "1B", sport: "baseball", sources: '["hsbn","gamechanger"]', igStatus: "low_confidence", igHandle: "dylan_first27", igConfidence: 58, nearestFacilityId: 0, nearestIgAccount: "@Gradumportstlucie", priorityScore: 82 },
];

export async function seedDatabase() {
  const existing = db.select({ count: count() }).from(facilities).get();
  if (existing && existing.count > 0) return;

  console.log("Seeding database...");

  // Insert facilities
  const insertedFacilities = FACILITIES_DATA.map(f => db.insert(facilities).values(f).returning().get());

  // Build facility lookup
  const facilityByNumber: Record<number, number> = {};
  insertedFacilities.forEach(f => { facilityByNumber[f.facilityNumber] = f.id; });

  // Map state to active facility IDs
  const stateFacilityMap: Record<string, number[]> = {};
  insertedFacilities.filter(f => f.status === "active").forEach(f => {
    if (!stateFacilityMap[f.state]) stateFacilityMap[f.state] = [];
    stateFacilityMap[f.state].push(f.id);
  });

  // Insert sample schools
  const schoolData = [
    { name: "Klein Oak HS", city: "Spring", state: "TX", lat: 30.08, lng: -95.42, hasBaseball: 1, hasSoftball: 1 },
    { name: "Broward County HS", city: "Pompano Beach", state: "FL", lat: 26.25, lng: -80.14, hasBaseball: 1, hasSoftball: 1 },
    { name: "Jupiter HS", city: "Jupiter", state: "FL", lat: 26.92, lng: -80.14, hasBaseball: 1, hasSoftball: 1 },
    { name: "Coral Springs HS", city: "Coral Springs", state: "FL", lat: 26.27, lng: -80.23, hasBaseball: 1, hasSoftball: 0 },
    { name: "Mount Pleasant HS", city: "Mount Pleasant", state: "SC", lat: 32.88, lng: -79.76, hasBaseball: 1, hasSoftball: 1 },
    { name: "Cary HS", city: "Cary", state: "NC", lat: 35.79, lng: -78.80, hasBaseball: 1, hasSoftball: 1 },
    { name: "Wake Forest HS", city: "Wake Forest", state: "NC", lat: 35.93, lng: -78.54, hasBaseball: 1, hasSoftball: 1 },
    { name: "Klein Collins HS", city: "Spring", state: "TX", lat: 30.07, lng: -95.43, hasBaseball: 1, hasSoftball: 0 },
    { name: "Charlotte HS", city: "Cornelius", state: "NC", lat: 35.48, lng: -80.86, hasBaseball: 1, hasSoftball: 1 },
    { name: "Port St. Lucie HS", city: "Port St. Lucie", state: "FL", lat: 27.29, lng: -80.35, hasBaseball: 1, hasSoftball: 1 },
  ];
  const insertedSchools = schoolData.map(s => db.insert(schools).values(s).returning().get());

  // Link schools to facilities (simplified)
  const schoolFacilityMap: Record<string, number[]> = {
    "TX": [facilityByNumber[24], facilityByNumber[12]], // Spring, Houston
    "FL": [facilityByNumber[3], facilityByNumber[14]], // Broward, Jupiter
    "SC": [facilityByNumber[6]], // Charleston
    "NC": [facilityByNumber[5], facilityByNumber[7]], // Cary, Charlotte
  };
  insertedSchools.forEach(school => {
    const fIds = schoolFacilityMap[school.state] ?? [];
    fIds.forEach(fId => {
      db.insert(facilitySchools).values({ facilityId: fId, schoolId: school.id, distanceMiles: 15, zone: "primary" }).run();
    });
  });

  // Insert sample athletes
  const athleteFacilityMap: Record<string, number> = {
    "TX": facilityByNumber[24], "FL": facilityByNumber[3],
    "SC": facilityByNumber[6], "NC": facilityByNumber[5],
  };

  const insertedAthletes = SAMPLE_ATHLETES.map(a => {
    const facilityId = athleteFacilityMap[a.state] ?? insertedFacilities[0].id;
    const updated = { ...a, nearestFacilityId: facilityId };
    return db.insert(athletes).values(updated).returning().get();
  });

  // Link athletes to facilities
  insertedAthletes.forEach(athlete => {
    const facilityId = athleteFacilityMap[athlete.state ?? ""] ?? insertedFacilities[0].id;
    db.insert(facilityAthletes).values({
      facilityId,
      athleteId: athlete.id,
      distanceMiles: 12,
      zone: "primary",
      isNearest: 1,
    }).run();
  });

  // Seed activity log
  const activities = [
    { type: "school_scan", message: "School discovery complete — Houston area", details: "34 schools found within 40mi of Gradum Houston", count: 34, facilityId: facilityByNumber[12] },
    { type: "roster_pull", message: "Roster pull complete — Klein Oak HS", details: "47 athletes collected (38 baseball, 9 softball)", count: 47, facilityId: facilityByNumber[24] },
    { type: "ig_match", message: "IG matching complete — Spring batch", details: "312 athletes processed, 267 matched (85.6%)", count: 267, facilityId: facilityByNumber[24] },
    { type: "roster_pull", message: "Perfect Game sync — FL athletes", details: "1,204 new athlete records pulled for FL facilities", count: 1204, facilityId: null },
    { type: "ig_match", message: "IG matching complete — Broward batch", details: "198 athletes processed, 161 matched (81.3%)", count: 161, facilityId: facilityByNumber[3] },
    { type: "school_scan", message: "School discovery complete — Tampa area", details: "51 schools found within 40mi of Gradum Tampa", count: 51, facilityId: facilityByNumber[25] },
    { type: "system", message: "Daily sync complete", details: "All 21 active facilities updated", count: 21, facilityId: null },
    { type: "roster_pull", message: "MaxPreps sync — NC athletes", details: "439 new athlete records pulled for NC facilities", count: 439, facilityId: null },
    { type: "ig_match", message: "IG matching complete — Jupiter batch", details: "143 athletes processed, 118 matched (82.5%)", count: 118, facilityId: facilityByNumber[14] },
    { type: "school_scan", message: "School discovery complete — DFW area", details: "89 schools found across Carrollton/Frisco/Ft Worth", count: 89, facilityId: facilityByNumber[4] },
  ];

  activities.forEach(a => db.insert(activityLog).values(a).run());

  // Seed admin user
  const hashedAdminPassword = bcrypt.hashSync("gradum2024", 10);
  db.insert(users).values({
    name: "Admin",
    email: "media@gradumgswing.com",
    password: hashedAdminPassword,
    role: "admin",
    assignedFacilities: "[]",
  }).run();

  // Seed staff user (username stored in email field)
  const hashedStaffPassword = bcrypt.hashSync("MediaLNS1!", 10);
  db.insert(users).values({
    name: "Teamgradum",
    email: "Teamgradum",
    password: hashedStaffPassword,
    role: "staff",
    assignedFacilities: "[]",
  }).run();

  console.log("Database seeded successfully!");
}
