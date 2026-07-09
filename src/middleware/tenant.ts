import { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      membership?: { organizationId: string; roleId: string; roleName: string };
    }
  }
}

export async function resolveTenant(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.usingApiKey) {
    // req.membership was already populated by apiKeyAuth.
    return next();
  }
  const organizationId = req.headers["x-organization-id"] as string | undefined;

  if (!organizationId) {
    return res.status(400).json({ error: "Missing X-Organization-Id header" });
  }

  if (!req.supabase || !req.user) {
    // Defensive: this middleware must run after authenticate().
    return res
      .status(500)
      .json({ error: "resolveTenant ran before authenticate" });
  }

  const { data, error } = await req.supabase
    .from("memberships")
    .select("organization_id, role_id, roles(name)")
    .eq("organization_id", organizationId)
    .eq("user_id", req.user.id)
    .single();

  if (error || !data) {
    // Either the org doesn't exist, or this user has no membership in it.
    // We deliberately return the SAME error for both cases — more on why below.
    return res
      .status(403)
      .json({ error: "You are not a member of this organization" });
  }

  req.membership = {
    organizationId: data.organization_id,
    roleId: data.role_id,
    roleName: (data.roles as any).name,
  };

  return next();
}
