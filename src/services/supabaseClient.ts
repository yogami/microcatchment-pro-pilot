/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

// Optional Supabase Init for MVP (allows UI to load without backend)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

if (!supabase) {
    console.warn("⚠️ Supabase Keys missing. Backend features (Auth/DB) will be disabled.");
}
