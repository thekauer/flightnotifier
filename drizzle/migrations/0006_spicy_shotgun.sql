CREATE TABLE "active_airports" (
	"airport_ident" text PRIMARY KEY NOT NULL,
	"touched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "active_airports_touched_at_idx" ON "active_airports" USING btree ("touched_at");
