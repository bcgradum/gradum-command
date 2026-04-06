import { db } from "./db";
import { facilities, schools, athletes, facilityAthletes, activityLog, users, facilitySchools } from "@shared/schema";
import type { Facility, School, Athlete, ActivityLog, User, InsertFacility, InsertSchool, InsertAthlete, InsertActivity, InsertUser } from "@shared/schema";
import { eq, and, desc, like, or, count, sql } from "drizzle-orm";

export interface IStorage {
  // Facilities
  getFacilities(): Facility[];
  getFacility(id: number): Facility | undefined;
  createFacility(data: InsertFacility): Facility;

  // Athletes
  getAthletesByFacility(facilityId: number, filters?: AthleteFilters): Athlete[];
  getAthleteCount(facilityId: number): number;
  getIgMatchedCount(facilityId: number): number;
  getLowConfidenceCount(facilityId: number): number;
  getReviewQueueCount(facilityId: number): number;
  getAllAthletes(filters?: AthleteFilters): Athlete[];
  updateAthleteIg(athleteId: number, data: Partial<Athlete>): Athlete | undefined;
  createAthlete(data: InsertAthlete): Athlete;

  // Schools
  getSchoolsByFacility(facilityId: number): School[];

  // Activity log
  getActivityLog(facilityId?: number, limit?: number): ActivityLog[];
  addActivity(data: InsertActivity): ActivityLog;

  // Users
  getUserByEmail(email: string): User | undefined;
  getUsers(): User[];
  createUser(data: InsertUser): User;

  // Dashboard stats
  getDashboardStats(): DashboardStats;
  getFacilityStats(facilityId: number): FacilityStats;
}

export interface AthleteFilters {
  sport?: string;
  gradYear?: number;
  igStatus?: string;
  search?: string;
  zone?: string;
  minConfidence?: number;
  maxConfidence?: number;
}

export interface DashboardStats {
  totalAthletes: number;
  totalMatched: number;
  matchRate: number;
  totalSchools: number;
  byState: { state: string; count: number }[];
  recentActivity: ActivityLog[];
}

export interface FacilityStats {
  totalAthletes: number;
  matched: number;
  lowConfidence: number;
  reviewQueue: number;
  notFound: number;
  primaryZone: number;
  secondaryZone: number;
  extendedZone: number;
  byGradYear: { year: number; count: number }[];
  bySchool: { school: string; count: number }[];
  matchRate: number;
}

export class Storage implements IStorage {
  getFacilities(): Facility[] {
    return db.select().from(facilities).all();
  }

  getFacility(id: number): Facility | undefined {
    return db.select().from(facilities).where(eq(facilities.id, id)).get();
  }

  createFacility(data: InsertFacility): Facility {
    return db.insert(facilities).values(data).returning().get();
  }

  getAthletesByFacility(facilityId: number, filters?: AthleteFilters): Athlete[] {
    const fa = db.select({ athleteId: facilityAthletes.athleteId })
      .from(facilityAthletes)
      .where(eq(facilityAthletes.facilityId, facilityId))
      .all()
      .map(r => r.athleteId);

    if (fa.length === 0) return [];

    let query = db.select().from(athletes);
    const conditions = [sql`${athletes.id} IN (${sql.join(fa.map(id => sql`${id}`), sql`, `)})`];

    if (filters?.sport) conditions.push(eq(athletes.sport, filters.sport));
    if (filters?.gradYear) conditions.push(eq(athletes.gradYear, filters.gradYear));
    if (filters?.igStatus) conditions.push(eq(athletes.igStatus, filters.igStatus));
    if (filters?.zone) {
      const zoneAthletes = db.select({ athleteId: facilityAthletes.athleteId })
        .from(facilityAthletes)
        .where(and(eq(facilityAthletes.facilityId, facilityId), eq(facilityAthletes.zone, filters.zone)))
        .all()
        .map(r => r.athleteId);
      if (zoneAthletes.length > 0) {
        conditions.push(sql`${athletes.id} IN (${sql.join(zoneAthletes.map(id => sql`${id}`), sql`, `)})`);
      }
    }
    if (filters?.search) {
      const s = `%${filters.search}%`;
      conditions.push(or(like(athletes.fullName, s), like(athletes.schoolName, s), like(athletes.igHandle, s)) as any);
    }
    if (filters?.minConfidence !== undefined) {
      conditions.push(sql`${athletes.igConfidence} >= ${filters.minConfidence}`);
    }
    if (filters?.maxConfidence !== undefined) {
      conditions.push(sql`${athletes.igConfidence} <= ${filters.maxConfidence}`);
    }

    return db.select().from(athletes).where(and(...conditions as any)).orderBy(desc(athletes.priorityScore)).all();
  }

  getAthleteCount(facilityId: number): number {
    const result = db.select({ count: count() }).from(facilityAthletes)
      .where(eq(facilityAthletes.facilityId, facilityId)).get();
    return result?.count ?? 0;
  }

  getIgMatchedCount(facilityId: number): number {
    const fa = db.select({ athleteId: facilityAthletes.athleteId })
      .from(facilityAthletes).where(eq(facilityAthletes.facilityId, facilityId)).all().map(r => r.athleteId);
    if (fa.length === 0) return 0;
    const result = db.select({ count: count() }).from(athletes)
      .where(and(
        sql`${athletes.id} IN (${sql.join(fa.map(id => sql`${id}`), sql`, `)})`,
        sql`${athletes.igHandle} IS NOT NULL`
      )).get();
    return result?.count ?? 0;
  }

  getLowConfidenceCount(facilityId: number): number {
    const fa = db.select({ athleteId: facilityAthletes.athleteId })
      .from(facilityAthletes).where(eq(facilityAthletes.facilityId, facilityId)).all().map(r => r.athleteId);
    if (fa.length === 0) return 0;
    const result = db.select({ count: count() }).from(athletes)
      .where(and(
        sql`${athletes.id} IN (${sql.join(fa.map(id => sql`${id}`), sql`, `)})`,
        sql`${athletes.igConfidence} >= 50`,
        sql`${athletes.igConfidence} < 60`
      )).get();
    return result?.count ?? 0;
  }

  getReviewQueueCount(facilityId: number): number {
    const fa = db.select({ athleteId: facilityAthletes.athleteId })
      .from(facilityAthletes).where(eq(facilityAthletes.facilityId, facilityId)).all().map(r => r.athleteId);
    if (fa.length === 0) return 0;
    const result = db.select({ count: count() }).from(athletes)
      .where(and(
        sql`${athletes.id} IN (${sql.join(fa.map(id => sql`${id}`), sql`, `)})`,
        eq(athletes.igStatus, "review")
      )).get();
    return result?.count ?? 0;
  }

  getAllAthletes(filters?: AthleteFilters): Athlete[] {
    const conditions: any[] = [];
    if (filters?.sport) conditions.push(eq(athletes.sport, filters.sport));
    if (filters?.igStatus) conditions.push(eq(athletes.igStatus, filters.igStatus));
    if (conditions.length === 0) return db.select().from(athletes).orderBy(desc(athletes.priorityScore)).all();
    return db.select().from(athletes).where(and(...conditions)).orderBy(desc(athletes.priorityScore)).all();
  }

  updateAthleteIg(athleteId: number, data: Partial<Athlete>): Athlete | undefined {
    db.update(athletes).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(athletes.id, athleteId)).run();
    return db.select().from(athletes).where(eq(athletes.id, athleteId)).get();
  }

  createAthlete(data: InsertAthlete): Athlete {
    return db.insert(athletes).values(data).returning().get();
  }

  getSchoolsByFacility(facilityId: number): School[] {
    const schoolIds = db.select({ schoolId: facilitySchools.schoolId })
      .from(facilitySchools).where(eq(facilitySchools.facilityId, facilityId)).all().map(r => r.schoolId);
    if (schoolIds.length === 0) return [];
    return db.select().from(schools)
      .where(sql`${schools.id} IN (${sql.join(schoolIds.map(id => sql`${id}`), sql`, `)})`)
      .all();
  }

  getActivityLog(facilityId?: number, limit = 50): ActivityLog[] {
    if (facilityId) {
      return db.select().from(activityLog)
        .where(or(eq(activityLog.facilityId, facilityId), sql`${activityLog.facilityId} IS NULL`))
        .orderBy(desc(activityLog.createdAt)).limit(limit).all();
    }
    return db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(limit).all();
  }

  addActivity(data: InsertActivity): ActivityLog {
    return db.insert(activityLog).values(data).returning().get();
  }

  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email)).get();
  }

  getUsers(): User[] {
    return db.select().from(users).all();
  }

  createUser(data: InsertUser): User {
    return db.insert(users).values(data).returning().get();
  }

  getDashboardStats(): DashboardStats {
    const totalAthletes = db.select({ count: count() }).from(athletes).get()?.count ?? 0;
    const totalMatched = db.select({ count: count() }).from(athletes)
      .where(sql`${athletes.igConfidence} >= 60`).get()?.count ?? 0;
    const totalSchools = db.select({ count: count() }).from(schools).get()?.count ?? 0;

    // Athletes by state
    const byState = db.select({ state: athletes.state, count: count() })
      .from(athletes)
      .groupBy(athletes.state)
      .orderBy(desc(count()))
      .limit(10)
      .all()
      .map(r => ({ state: r.state ?? "Unknown", count: r.count }));

    const recentActivity = db.select().from(activityLog).orderBy(desc(activityLog.createdAt)).limit(20).all();

    return {
      totalAthletes,
      totalMatched,
      matchRate: totalAthletes > 0 ? Math.round((totalMatched / totalAthletes) * 100) : 0,
      totalSchools,
      byState,
      recentActivity,
    };
  }

  getFacilityStats(facilityId: number): FacilityStats {
    const fa = db.select({ athleteId: facilityAthletes.athleteId, zone: facilityAthletes.zone })
      .from(facilityAthletes).where(eq(facilityAthletes.facilityId, facilityId)).all();

    const athleteIds = fa.map(r => r.athleteId);
    const primaryIds = fa.filter(r => r.zone === "primary").map(r => r.athleteId);
    const secondaryIds = fa.filter(r => r.zone === "secondary").map(r => r.athleteId);
    const extendedIds = fa.filter(r => r.zone === "extended").map(r => r.athleteId);

    if (athleteIds.length === 0) {
      return { totalAthletes: 0, matched: 0, lowConfidence: 0, reviewQueue: 0, notFound: 0, primaryZone: 0, secondaryZone: 0, extendedZone: 0, byGradYear: [], bySchool: [], matchRate: 0 };
    }

    const inClause = sql`${athletes.id} IN (${sql.join(athleteIds.map(id => sql`${id}`), sql`, `)})`;
    const matched = db.select({ count: count() }).from(athletes).where(and(inClause, sql`${athletes.igHandle} IS NOT NULL`)).get()?.count ?? 0;
    const lowConf = db.select({ count: count() }).from(athletes).where(and(inClause, sql`${athletes.igConfidence} >= 50`, sql`${athletes.igConfidence} < 60`)).get()?.count ?? 0;
    const review = db.select({ count: count() }).from(athletes).where(and(inClause, eq(athletes.igStatus, "review"))).get()?.count ?? 0;
    const notFound = db.select({ count: count() }).from(athletes).where(and(inClause, eq(athletes.igStatus, "not_found"))).get()?.count ?? 0;

    const byGradYear = db.select({ year: athletes.gradYear, count: count() }).from(athletes)
      .where(inClause).groupBy(athletes.gradYear).orderBy(athletes.gradYear).all()
      .map(r => ({ year: r.year ?? 0, count: r.count }));

    const bySchool = db.select({ school: athletes.schoolName, count: count() }).from(athletes)
      .where(inClause).groupBy(athletes.schoolName).orderBy(desc(count())).limit(10).all()
      .map(r => ({ school: r.school ?? "Unknown", count: r.count }));

    return {
      totalAthletes: athleteIds.length,
      matched,
      lowConfidence: lowConf,
      reviewQueue: review,
      notFound,
      primaryZone: primaryIds.length,
      secondaryZone: secondaryIds.length,
      extendedZone: extendedIds.length,
      byGradYear,
      bySchool,
      matchRate: athleteIds.length > 0 ? Math.round((matched / athleteIds.length) * 100) : 0,
    };
  }
}

export const storage = new Storage();
