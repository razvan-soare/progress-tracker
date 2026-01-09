import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { secureStorageAdapter } from "./storage";
import type { Database } from "./types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not configured. " +
      "Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file."
  );
}

/**
 * Typed Supabase client instance configured with:
 * - Secure token storage using expo-secure-store
 * - Auto-refresh of auth tokens
 * - Persistent sessions across app restarts
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl ?? "",
  supabaseAnonKey ?? "",
  {
    auth: {
      storage: secureStorageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
