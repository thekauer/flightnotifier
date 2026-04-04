import { pgTable, text, timestamp, integer, real, doublePrecision, boolean, index } from 'drizzle-orm/pg-core';

export const aircraft = pgTable('aircraft', {
  icao24: text('icao24').primaryKey(),
  icaoType: text('icao_type'),
  manufacturer: text('manufacturer'),
  registration: text('registration'),
  owner: text('owner'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const runways = pgTable('runways', {
  id: integer('id').primaryKey(),
  airportRef: integer('airport_ref'),
  airportIdent: text('airport_ident'),
  lengthFt: integer('length_ft'),
  widthFt: integer('width_ft'),
  surface: text('surface'),
  lighted: boolean('lighted'),
  closed: boolean('closed'),
  leIdent: text('le_ident'),
  leLatitudeDeg: doublePrecision('le_latitude_deg'),
  leLongitudeDeg: doublePrecision('le_longitude_deg'),
  leElevationFt: real('le_elevation_ft'),
  leHeadingDegT: real('le_heading_deg_t'),
  leDisplacedThresholdFt: real('le_displaced_threshold_ft'),
  heIdent: text('he_ident'),
  heLatitudeDeg: doublePrecision('he_latitude_deg'),
  heLongitudeDeg: doublePrecision('he_longitude_deg'),
  heElevationFt: real('he_elevation_ft'),
  heHeadingDegT: real('he_heading_deg_t'),
  heDisplacedThresholdFt: real('he_displaced_threshold_ft'),
}, (table) => [
  index('runways_airport_ident_idx').on(table.airportIdent),
]);

export const flightRoutes = pgTable('flight_routes', {
  callsign: text('callsign').primaryKey(),
  origin: text('origin'),
  destination: text('destination'),
  route: text('route'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('flight_routes_updated_at_idx').on(table.updatedAt),
]);
