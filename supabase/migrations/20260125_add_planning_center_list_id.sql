-- Add planning_center_list_id column to email_subscribers table
ALTER TABLE "public"."email_subscribers"
ADD COLUMN "planning_center_list_id" text;

-- Add comment for documentation
COMMENT ON COLUMN "public"."email_subscribers"."planning_center_list_id" IS 'Planning Center list ID that this user is mapped to for filtering prayers by list members';
