ALTER TABLE "campaigns" ADD COLUMN "source_template_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_source_template_id_templates_id_fk" FOREIGN KEY ("source_template_id") REFERENCES "templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
