ALTER TABLE "campaign_delivery_events" ADD COLUMN "provider_event_id" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "html_body" text;--> statement-breakpoint
ALTER TABLE "message_templates" ADD COLUMN "content" jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_campaign_delivery_events_provider_event" ON "campaign_delivery_events" ("provider_event_id");