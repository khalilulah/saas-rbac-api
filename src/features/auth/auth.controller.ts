import { Request, Response } from "express";
import { createUserScopedClient } from "../../db/client";

declare global {
  namespace Express {
    interface Request {
      usingApiKey?: boolean;
    }
  }
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  // No JWT exists yet at this point, so we use a plain anon client —
  // not createUserScopedClient with a token, since there's no token
  // to scope it with. Signing in is the one operation that happens
  // "pre-identity."
  const supabase = createUserScopedClient(""); // empty token, unused for this call

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  return res.status(200).json({
    access_token: data.session.access_token,
    user: { id: data.user.id, email: data.user.email },
  });
}
