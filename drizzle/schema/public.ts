import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const aircraft = pgTable('aircraft', {
  icao24: text('icao24').primaryKey(),
  icaoType: text('icao_type'),
  manufacturer: text('manufacturer'),
  registration: text('registration'),
  owner: text('owner'),
  firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
