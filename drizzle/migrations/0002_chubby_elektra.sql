CREATE TABLE "runways" (
	"id" integer PRIMARY KEY NOT NULL,
	"airport_ref" integer,
	"airport_ident" text,
	"length_ft" integer,
	"width_ft" integer,
	"surface" text,
	"lighted" boolean,
	"closed" boolean,
	"le_ident" text,
	"le_latitude_deg" real,
	"le_longitude_deg" real,
	"le_elevation_ft" real,
	"le_heading_deg_t" real,
	"le_displaced_threshold_ft" real,
	"he_ident" text,
	"he_latitude_deg" real,
	"he_longitude_deg" real,
	"he_elevation_ft" real,
	"he_heading_deg_t" real,
	"he_displaced_threshold_ft" real
);
--> statement-breakpoint
CREATE INDEX "runways_airport_ident_idx" ON "runways" USING btree ("airport_ident");