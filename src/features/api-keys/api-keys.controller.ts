// src/features/api-keys/api-keys.controller.ts
import { Request, Response } from "express";
import { generateApiKey } from "./key-utils";

export async function createApiKey(req: Request, res: Response) {
  const { name, roleName } = req.body;

  if (!name || !roleName) {
    return res.status(400).json({ error: "name and roleName are required" });
  }

  const { data: role, error: roleError } = await req
    .supabase!.from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (roleError || !role) {
    return res.status(400).json({ error: "Invalid role name" });
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

  if (error) return res.status(500).json({ error: error.message });

  // This is the ONLY time the raw key is ever returned. It cannot
  // be retrieved again — only the hash is stored from this point on.
  return res.status(201).json({
    apiKey: { ...data, key: rawKey },
    warning: "This key will not be shown again. Store it securely now.",
  });
}
