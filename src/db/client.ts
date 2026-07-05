import { createClient, SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string;
const SUPABASE_SERVICE_ROLE_KEY = process.env
  .SUPABASE_SERVICE_ROLE_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

/**
 * Creates a Supabase client scoped to a specific user's JWT.
 * This is what makes RLS policies evaluate "as this user" —
 * every query made with this client carries the user's identity,
 * so Postgres can enforce row-level policies against it.
 *
 * One of these must be created PER REQUEST, using that request's token.
 * It must never be reused across requests from different users.
 */
export function createUserScopedClient(userJwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    realtime: {
      transport: ws as any,
    },
  });
}

/**
 * Admin client — bypasses RLS entirely using the service_role key.
 * Only for trusted server-side operations we explicitly decide need
 * full access (e.g. system-level provisioning tasks).
 * Never use this as the default client for handling user requests.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: {
      transport: ws as any,
    },
  },
);
