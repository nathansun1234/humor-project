import { createClient } from "@supabase/supabase-js";

// Build the Supabase URL from your project ID
const supabaseUrl = `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables!");
}

// Create a Supabase client once and export it
export const supabase = createClient(supabaseUrl, supabaseKey);