CREATE TABLE IF NOT EXISTS "birthday_engagement_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" text NOT NULL,
	"template_id" uuid,
	"days_before" integer DEFAULT 0 NOT NULL,
	"local_delivery_time" text DEFAULT '09:00' NOT NULL,
	"offer_text" text,
	"eligibility_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "birthday_engagement_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"birthday_year" integer NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_birthday_engagement_occurrence" UNIQUE("campaign_id","patient_id","birthday_year")
);
--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "website" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_birthday_engagement_campaigns_practice" ON "birthday_engagement_campaigns" ("practice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_birthday_engagement_occurrences_due" ON "birthday_engagement_occurrences" ("practice_id","status","scheduled_for");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_campaigns" ADD CONSTRAINT "birthday_engagement_campaigns_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_campaigns" ADD CONSTRAINT "birthday_engagement_campaigns_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_campaigns" ADD CONSTRAINT "birthday_engagement_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_occurrences" ADD CONSTRAINT "birthday_engagement_occurrences_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_occurrences" ADD CONSTRAINT "birthday_engagement_occurrences_campaign_id_birthday_engagement_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "birthday_engagement_campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "birthday_engagement_occurrences" ADD CONSTRAINT "birthday_engagement_occurrences_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
