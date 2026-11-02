CREATE TABLE IF NOT EXISTS "appointment_reminder_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"interval" text NOT NULL,
	"channel" text NOT NULL,
	"local_send_time" text DEFAULT '09:00' NOT NULL,
	"template_id" uuid,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"practice_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"manual" boolean DEFAULT false NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"attempted_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"provider_message_id" text,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_appointment_reminder_occurrence" UNIQUE("appointment_id","schedule_id","channel","patient_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_appointment_reminder_schedules_practice" ON "appointment_reminder_schedules" ("practice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_appointment_reminders_due" ON "appointment_reminders" ("practice_id","status","scheduled_for");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_appointment_reminders_appointment" ON "appointment_reminders" ("appointment_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminder_schedules" ADD CONSTRAINT "appointment_reminder_schedules_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminder_schedules" ADD CONSTRAINT "appointment_reminder_schedules_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminder_schedules" ADD CONSTRAINT "appointment_reminder_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_practice_id_practices_id_fk" FOREIGN KEY ("practice_id") REFERENCES "practices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_schedule_id_appointment_reminder_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "appointment_reminder_schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "appointment_reminders" ADD CONSTRAINT "appointment_reminders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
