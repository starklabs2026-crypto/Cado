CREATE TABLE "guest_daily_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"guest_id" text NOT NULL,
	"date" date NOT NULL,
	"scans_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_users" (
	"id" text PRIMARY KEY NOT NULL,
	"session_token" text NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_users_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "calories" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "protein" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "carbs" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "fat" real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "serving_size" real DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "food_database" ADD COLUMN "serving_unit" text DEFAULT 'g' NOT NULL;
--> statement-breakpoint
ALTER TABLE "guest_daily_usage" ADD CONSTRAINT "guest_daily_usage_guest_id_guest_users_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "guest_date_unique" ON "guest_daily_usage" USING btree ("guest_id","date");
--> statement-breakpoint
ALTER TABLE "food_database" DROP COLUMN "calories_per_100g";
--> statement-breakpoint
ALTER TABLE "food_database" DROP COLUMN "protein_per_100g";
--> statement-breakpoint
ALTER TABLE "food_database" DROP COLUMN "carbs_per_100g";
--> statement-breakpoint
ALTER TABLE "food_database" DROP COLUMN "fat_per_100g";
--> statement-breakpoint
ALTER TABLE "food_database" DROP COLUMN "serving_size_g";
