// src/features/api-keys/api-keys.controller.ts
import { Request, Response } from "express";
import { generateApiKey } from "./key-utils";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const createApiKey = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, roleName } = req.body;

    if (!name || !roleName) {
      throw new AppError(400, "name and roleName are required");
    }

    const { data: role, error: roleError } = await req
      .supabase!.from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (roleError || !role) {
      throw new AppError(400, "Invalid role name");
    }

    const { rawKey, prefix, hash } = generateApiKey();

    const { data, error } = await req
      .supabase!.from("api_keys")
      .insert({
        organization_id: req.membership!.organizationId,
        role_id: role.id,
        key_hash: hash,
        key_prefix: prefix,
        name,
      })
      .select("id, name, key_prefix, created_at")
      .single();

    if (error) throw new AppError(500, error.message);

    // This is the ONLY time the raw key is ever returned. It cannot
    // be retrieved again — only the hash is stored from this point on.
    return res.status(201).json({
      apiKey: { ...data, key: rawKey },
      warning: "This key will not be shown again. Store it securely now.",
    });
  },
);

// src/features/api-keys/api-keys.controller.ts (add to existing file)

export const listApiKeys = asyncHandler(async (req: Request, res: Response) => {
  const { data, error } = await req
    .supabase!.from("api_keys")
    .select("id, name, key_prefix, created_at, revoked_at, roles(name)")
    .eq("organization_id", req.membership!.organizationId);

  if (error) throw new AppError(500, error.message);

  // Never select key_hash here — there's no reason a client ever needs
  // the hash, and returning it would just widen the attack surface
  // for no benefit.
  return res.json({ apiKeys: data });
});

export const revokeApiKey = asyncHandler(
  async (req: Request, res: Response) => {
    const { keyId } = req.params;

    const { data, error } = await req
      .supabase!.from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId)
      .eq("organization_id", req.membership!.organizationId)
      .select("id, name, revoked_at")
      .single();

    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(404, "API key not found");

    return res.json({ apiKey: data });
  },
);
