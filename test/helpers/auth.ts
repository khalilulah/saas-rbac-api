// tests/helpers/auth.ts
import { supabaseAdmin } from "../../src/db/client";
import { createUserScopedClient } from "../../src/db/client";

export async function createTestUser(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // skip email verification for test users
  });
  if (error) throw error;
  return data.user;
}

export async function loginTestUser(
  email: string,
  password: string,
): Promise<string> {
  const supabase = createUserScopedClient("");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session) throw new Error(`Login failed for ${email}`);
  return data.session.access_token;
}

export async function deleteTestUser(userId: string) {
  await supabaseAdmin.auth.admin.deleteUser(userId);
}
