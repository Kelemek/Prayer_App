-- Consolidated member_prayer_updates table setup
-- Includes: table creation, RLS policies, trigger, and column additions

-- Create member_prayer_updates table for updates on Planning Center member cards
CREATE TABLE IF NOT EXISTS "public"."member_prayer_updates" (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  person_id text NOT NULL,
  content text NOT NULL,
  is_answered BOOLEAN DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE "public"."member_prayer_updates" ENABLE ROW LEVEL SECURITY;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_person_id ON "public"."member_prayer_updates"(person_id);
CREATE INDEX IF NOT EXISTS idx_member_prayer_updates_created_at ON "public"."member_prayer_updates"(created_at);

-- Add table comment
COMMENT ON TABLE "public"."member_prayer_updates" IS 'Stores updates/comments for Planning Center member prayer cards';
COMMENT ON COLUMN "public"."member_prayer_updates"."person_id" IS 'Unique Planning Center person ID - persists even if name changes';
COMMENT ON COLUMN "public"."member_prayer_updates"."is_answered" IS 'Whether this prayer update has been answered';

-- Create RLS policies (permissive - security handled at application level)
CREATE POLICY "Allow all select on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all insert on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all update on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all delete on member_prayer_updates" 
ON "public"."member_prayer_updates" 
FOR DELETE 
USING (true);

-- Grant roles access to the table
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."member_prayer_updates" TO "anon";
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."member_prayer_updates" TO "authenticated";

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_member_prayer_updates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER member_prayer_updates_update_timestamp
BEFORE UPDATE ON "public"."member_prayer_updates"
FOR EACH ROW
EXECUTE FUNCTION update_member_prayer_updates_timestamp();
