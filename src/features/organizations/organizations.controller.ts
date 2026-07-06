// src/features/organizations/organizations.controller.ts
import { Request, Response } from "express";

export async function createOrganization(req: Request, res: Response) {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const { data, error } = await req.supabase!.rpc(
    "create_organization_with_admin",
    {
      org_name: name,
    },
  );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ organizationId: data[0].organization_id });
}
