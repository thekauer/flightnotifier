import {
  pgSchema,
  bigserial,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  real,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const ingestSchema = pgSchema('ingest');

export const openskyStateVectors = ingestSchema.table(
  'opensky_state_vectors',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    pollId: uuid('poll_id').notNull(),
    polledAt: timestamp('polled_at', { withTimezone: true }).notNull().defaultNow(),
    responseTime: integer('response_time').notNull(),
    icao24: text('icao24').notNull(),
    callsign: text('callsign'),
    originCountry: text('origin_country'),
    timePosition: integer('time_position'),
    lastContact: integer('last_contact'),
    longitude: doublePrecision('longitude'),
    latitude: doublePrecision('latitude'),
    baroAltitude: doublePrecision('baro_altitude'),
    onGround: boolean('on_ground'),
    velocity: doublePrecision('velocity'),
    trueTrack: doublePrecision('true_track'),
    verticalRate: doublePrecision('vertical_rate'),
    sensors: jsonb('sensors').$type<readonly number[] | null>(),
    geoAltitude: doublePrecision('geo_altitude'),
    squawk: text('squawk'),
    spi: boolean('spi'),
    positionSource: smallint('position_source'),
  },
  (table) => [
    index('idx_osv_polled_at').on(table.polledAt),
    index('idx_osv_icao24').on(table.icao24),
    index('idx_osv_icao24_polled_at').on(table.icao24, table.polledAt),
  ],
);

export const metar = ingestSchema.table(
  'metar',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    station: text('station').notNull(),
    raw: text('raw').notNull(),
    observationTime: timestamp('observation_time', { withTimezone: true }),
    temp: real('temp'),
    dewpoint: real('dewpoint'),
    windDirection: smallint('wind_direction'),
    windSpeed: smallint('wind_speed'),
    windGust: smallint('wind_gust'),
    visibility: real('visibility'),
    clouds: jsonb('clouds').$type<readonly { cover: string; base: number }[] | null>(),
    ceiling: integer('ceiling'),
    qnh: real('qnh'),
    flightCategory: text('flight_category'),
  },
  (table) => [index('idx_metar_fetched_at').on(table.fetchedAt)],
);

export const flightyArrivals = ingestSchema.table(
  'flighty_arrivals',
  {
    id: bigserial({ mode: 'number' }).primaryKey(),
    scrapedAt: timestamp('scraped_at', { withTimezone: true }).notNull().defaultNow(),
    flightId: text('flight_id').notNull(),
    flightNumber: text('flight_number').notNull(),
    airlineIata: text('airline_iata'),
    airlineName: text('airline_name'),
    city: text('city'),
    status: jsonb('status'),
    originalTime: jsonb('original_time'),
    newTime: jsonb('new_time'),
    departure: jsonb('departure'),
    arrival: jsonb('arrival'),
    secondaryCorner: text('secondary_corner'),
  },
  (table) => [
    index('idx_fa_scraped_at').on(table.scrapedAt),
    index('idx_fa_flight_number').on(table.flightNumber),
  ],
);
