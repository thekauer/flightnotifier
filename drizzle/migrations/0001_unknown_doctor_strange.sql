CREATE TABLE "ingest"."opensky_tracks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"icao24" text NOT NULL,
	"requested_time" integer NOT NULL,
	"start_time" integer,
	"end_time" integer,
	"callsign" text,
	"path" jsonb,
	"source" text DEFAULT 'state_vectors' NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_ost_icao24" ON "ingest"."opensky_tracks" USING btree ("icao24");--> statement-breakpoint
CREATE INDEX "idx_ost_fetched_at" ON "ingest"."opensky_tracks" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "idx_ost_icao24_requested_time" ON "ingest"."opensky_tracks" USING btree ("icao24","requested_time");