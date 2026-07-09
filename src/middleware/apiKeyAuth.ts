// src/middleware/apiKeyAuth.ts
import { Request, Response, NextFunction } from "express";
import { hashApiKey } from "../features/api-keys/key-utils";
import { supabaseAdmin } from "../db/client";
import jwt from "jsonwebtoken";
import { createUserScopedClient } from "../db/client";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET as string;

export async function apiKeyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const rawKey = req.headers["x-api-key"] as string | undefined;

  if (!rawKey) {
    // No key present — not an error here, just means this middleware
    // doesn't apply. Let the request fall through to JWT-based auth.
    return next();
  }

  const hash = hashApiKey(rawKey);

  // We must use supabaseAdmin here, not a user-scoped client — there is
  // no JWT at all for this request, so there's no auth.uid() to satisfy
  // any RLS policy. This lookup has to happen with elevated access,
  // similar to the email lookup in the invite-member flow.
  const { data: keyRecord, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, organization_id, role_id, revoked_at, roles(name)")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !keyRecord) {
    return res.status(401).json({ error: "Invalid API key" });
  }

  if (keyRecord.revoked_at) {
    return res.status(401).json({ error: "This API key has been revoked" });
  }

  const customToken = jwt.sign(
    {
      // "sub" must be present and unique-ish; we use the key's own id
      // since there's no human user to represent.
      sub: keyRecord.id,
      role: "authenticated", // required so PostgREST treats this as an authenticated request
      org_id: keyRecord.organization_id, // our custom claim — this is what RLS will check
    },
    JWT_SECRET,
    { expiresIn: "5m", algorithm: "HS256" }, // short-lived on purpose — minted fresh per request, never reused
  );

  req.supabase = createUserScopedClient(customToken);

  // Populate req.membership directly — same shape resolveTenant produces,
  // so every downstream route handler and requirePermission call works
  // identically regardless of whether a human or a machine made the request.
  req.membership = {
    organizationId: keyRecord.organization_id,
    roleId: keyRecord.role_id,
    roleName: (keyRecord.roles as any).name,
  };

  // No req.user is set here — there's no human identity behind this
  // request. Anything relying on req.user (rare in our routes so far)
  // needs to tolerate that being absent for API-key-authenticated requests.

  req.usingApiKey = true;

  return next();
}
