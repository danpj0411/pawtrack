-- PawTracker v2 migration
-- Run this in your Supabase SQL editor to add step tracking support

ALTER TABLE walks
  ADD COLUMN IF NOT EXISTS steps_count integer DEFAULT 0;

-- Optional: view summary
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'walks'
ORDER BY ordinal_position;
