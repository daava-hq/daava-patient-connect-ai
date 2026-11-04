ALTER TABLE "appointments"
ADD COLUMN IF NOT EXISTS "confirmation_status" text;
