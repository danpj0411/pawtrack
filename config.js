// ======================================================
// SUPABASE CONFIGURATION
// ======================================================
// 1. Go to https://supabase.com and create a free account
// 2. Create a new project
// 3. Go to Settings → API
// 4. Copy your Project URL and anon/public key below
// 5. Then go to the SQL Editor and run the SQL in setup.sql
// ======================================================

const SUPABASE_URL = 'https://diuxelwqegtjojebacks.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pD9lyGCKbIIsXCWkzhw-UA_HRtYuM_t';

// ======================================================
// DO NOT EDIT BELOW THIS LINE
// ======================================================
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
