ALTER TABLE "practices" ADD COLUMN "email_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "practices" ADD COLUMN "sms_enabled" boolean DEFAULT false NOT NULL;