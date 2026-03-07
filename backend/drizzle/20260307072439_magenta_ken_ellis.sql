CREATE TABLE "food_database" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"calories_per_100g" real NOT NULL,
	"protein_per_100g" real NOT NULL,
	"carbs_per_100g" real NOT NULL,
	"fat_per_100g" real NOT NULL,
	"serving_size_g" real DEFAULT 100 NOT NULL,
	"description" text,
	"aliases" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "food_database_name_idx" ON "food_database" USING btree ("name");--> statement-breakpoint
CREATE INDEX "food_database_category_idx" ON "food_database" USING btree ("category");