CREATE TABLE "group_membership_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"patient_id" uuid,
	"action" text NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "group_type" text DEFAULT 'static' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "criteria" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_group_membership_history_practice_group" ON "group_membership_history" ("practice_id","group_id");--> statement-breakpoint
CREATE INDEX "idx_groups_practice_archived" ON "groups" ("practice_id","archived_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_membership_history" ADD CONSTRAINT "group_membership_history_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_membership_history" ADD CONSTRAINT "group_membership_history_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_membership_history" ADD CONSTRAINT "group_membership_history_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "group_membership_history" ADD CONSTRAINT "group_membership_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
