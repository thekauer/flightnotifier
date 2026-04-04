CREATE TABLE "flight_routes" (
	"callsign" text PRIMARY KEY NOT NULL,
	"origin" text,
	"destination" text,
	"route" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "flight_routes_updated_at_idx" ON "flight_routes" USING btree ("updated_at");
