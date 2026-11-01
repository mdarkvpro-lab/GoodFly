import { createBrowserClient } from "@supabase/ssr";

/** Supabase client in the browser (public key + the signed-in session cookie). Used for live alerts only. */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
