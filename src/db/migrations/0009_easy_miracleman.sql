CREATE TABLE IF NOT EXISTS "opendental_recalls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"opendental_recall_id" bigint NOT NULL,
	"recall_type_num" integer NOT NULL,
	"due_date" date,
	"date_scheduled" date,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opendental_recalls_practice_id_opendental_recall_id_unique" UNIQUE("practice_id","opendental_recall_id")
);
--> statement-breakpoint
ALTER TABLE "practice_opendental_credentials" ADD COLUMN "last_recall_synced_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_opendental_recalls_practice_patient_due" ON "opendental_recalls" ("practice_id","patient_id","due_date");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opendental_recalls" ADD CONSTRAINT "opendental_recalls_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opendental_recalls" ADD CONSTRAINT "opendental_recalls_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
