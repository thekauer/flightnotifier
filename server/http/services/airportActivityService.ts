import { desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/drizzle/db';
import { activeAirports } from '@/drizzle/schema/public';
import type { AirportSearchRecord } from '@/lib/airport-catalog';

export const ACTIVE_AIRPORT_WINDOW_MS = 5 * 60_000;

type PgLikeError = {
  code?: string;
  message?: string;
};

function asPgError(error: unknown): PgLikeError | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  return error as PgLikeError;
}

function isMissingDbObjectError(error: unknown): boolean {
  const pgError = asPgError(error);
  return pgError?.code === '42P01' || pgError?.code === '42703';
}

function logMissingDbObject(context: string, error: unknown): void {
  const pgError = asPgError(error);
  console.warn(`[airport-activity] ${context}: ${pgError?.message ?? 'missing database object'}`);
}

export async function touchActiveAirport(airport: Pick<AirportSearchRecord, 'ident' | 'iata' | 'name' | 'latitude' | 'longitude'>): Promise<void> {
  try {
    await db
      .insert(activeAirports)
      .values({
        airportIdent: airport.ident,
        iata: airport.iata,
        name: airport.name,
        latitude: airport.latitude,
        longitude: airport.longitude,
        touchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: activeAirports.airportIdent,
        set: {
          iata: airport.iata,
          name: airport.name,
          latitude: airport.latitude,
          longitude: airport.longitude,
          touchedAt: sql`now()`,
        },
      });
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('touch skipped', error);
      return;
    }

    throw error;
  }
}

export async function getActiveAirportIdents(): Promise<string[]> {
  try {
    const rows = await db
      .select({ airportIdent: activeAirports.airportIdent })
      .from(activeAirports)
      .where(gt(activeAirports.touchedAt, new Date(Date.now() - ACTIVE_AIRPORT_WINDOW_MS)))
      .orderBy(desc(activeAirports.touchedAt));

    return rows.map((row) => row.airportIdent);
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('active airport query skipped', error);
      return [];
    }

    throw error;
  }
}

export interface ActiveAirportRecord {
  airportIdent: string;
  iata: string | null;
  name: string;
  latitude: number;
  longitude: number;
  touchedAt: Date;
}

export async function getActiveAirports(): Promise<ActiveAirportRecord[]> {
  try {
    return await db
      .select({
        airportIdent: activeAirports.airportIdent,
        iata: activeAirports.iata,
        name: activeAirports.name,
        latitude: activeAirports.latitude,
        longitude: activeAirports.longitude,
        touchedAt: activeAirports.touchedAt,
      })
      .from(activeAirports)
      .where(gt(activeAirports.touchedAt, new Date(Date.now() - ACTIVE_AIRPORT_WINDOW_MS)))
      .orderBy(desc(activeAirports.touchedAt));
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('active airport records query skipped', error);
      return [];
    }

    throw error;
  }
}

export async function getActiveAirportTouchedAt(airportIdent: string): Promise<Date | null> {
  try {
    const rows = await db
      .select({ touchedAt: activeAirports.touchedAt })
      .from(activeAirports)
      .where(eq(activeAirports.airportIdent, airportIdent))
      .limit(1);

    return rows[0]?.touchedAt ?? null;
  } catch (error) {
    if (isMissingDbObjectError(error)) {
      logMissingDbObject('airport touch lookup skipped', error);
      return null;
    }

    throw error;
  }
}
