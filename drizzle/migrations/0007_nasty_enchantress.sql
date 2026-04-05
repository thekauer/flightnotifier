TRUNCATE TABLE "active_airports";
--> statement-breakpoint
ALTER TABLE "active_airports" ADD COLUMN "iata" text;--> statement-breakpoint
ALTER TABLE "active_airports" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "active_airports" ADD COLUMN "latitude" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "active_airports" ADD COLUMN "longitude" double precision NOT NULL;
