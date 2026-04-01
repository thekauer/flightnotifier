CREATE SCHEMA "ingest";
--> statement-breakpoint
CREATE TABLE "ingest"."flighty_arrivals" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"flight_id" text NOT NULL,
	"flight_number" text NOT NULL,
	"airline_iata" text,
	"airline_name" text,
	"city" text,
	"status" jsonb,
	"original_time" jsonb,
	"new_time" jsonb,
	"departure" jsonb,
	"arrival" jsonb,
	"secondary_corner" text
);
--> statement-breakpoint
CREATE TABLE "ingest"."metar" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"station" text NOT NULL,
	"raw" text NOT NULL,
	"observation_time" timestamp with time zone,
	"temp" real,
	"dewpoint" real,
	"wind_direction" smallint,
	"wind_speed" smallint,
	"wind_gust" smallint,
	"visibility" real,
	"clouds" jsonb,
	"ceiling" integer,
	"qnh" real,
	"flight_category" text
);
--> statement-breakpoint
CREATE TABLE "ingest"."opensky_state_vectors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"poll_id" uuid NOT NULL,
	"polled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_time" integer NOT NULL,
	"icao24" text NOT NULL,
	"callsign" text,
	"origin_country" text,
	"time_position" integer,
	"last_contact" integer,
	"longitude" double precision,
	"latitude" double precision,
	"baro_altitude" double precision,
	"on_ground" boolean,
	"velocity" double precision,
	"true_track" double precision,
	"vertical_rate" double precision,
	"sensors" jsonb,
	"geo_altitude" double precision,
	"squawk" text,
	"spi" boolean,
	"position_source" smallint
);
--> statement-breakpoint
CREATE TABLE "aircraft" (
	"icao24" text PRIMARY KEY NOT NULL,
	"icao_type" text,
	"manufacturer" text,
	"registration" text,
	"owner" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_fa_scraped_at" ON "ingest"."flighty_arrivals" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "idx_fa_flight_number" ON "ingest"."flighty_arrivals" USING btree ("flight_number");--> statement-breakpoint
CREATE INDEX "idx_metar_fetched_at" ON "ingest"."metar" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_osv_polled_at" ON "ingest"."opensky_state_vectors" USING btree ("polled_at");--> statement-breakpoint
CREATE INDEX "idx_osv_icao24" ON "ingest"."opensky_state_vectors" USING btree ("icao24");--> statement-breakpoint
CREATE INDEX "idx_osv_icao24_polled_at" ON "ingest"."opensky_state_vectors" USING btree ("icao24","polled_at");