import { Request, Response, NextFunction } from "express";
import { createUserScopedClient } from "../db/client";
import { SupabaseClient } from "@supabase/supabase-js";

// Extend Express's Request type so downstream code gets type safety
// on req.user and req.supabase instead of `any`.
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      supabase?: SupabaseClient;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Missing or malformed Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Malformed Authorization header" });
  }

  // Build a client scoped to this exact token, then ask Supabase
  // to verify it and tell us who it belongs to.
  const supabase = createUserScopedClient(token);
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach both identity AND the scoped client to the request.
  // Every downstream handler queries the DB through req.supabase,
  // which means every query automatically carries this user's
  // identity — and RLS policies evaluate against it.
  req.user = { id: data.user.id, email: data.user.email ?? "" };
  req.supabase = supabase;

  return next();
}
