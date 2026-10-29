import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DB_SCHEMA, supabasePublicKey, supabaseSecretKey, supabaseUrl } from "@/lib/env";

/** Acts as the signed-in person. Database security rules apply. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl(), supabasePublicKey(), {
    db: { schema: DB_SCHEMA },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a page (read-only cookies). The proxy refreshes sessions, so this is fine.
        }
      },
    },
  });
}

/**
 * Server-only admin client that skips the security rules.
 * Only used for: reading the secret calendar link, writing synced lessons,
 * and the first-time tutor setup. Always check the role before using it.
 */
export function createAdminClient() {
  return createPlainClient(supabaseUrl(), supabaseSecretKey(), {
    db: { schema: DB_SCHEMA },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
