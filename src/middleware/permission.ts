import { Request, Response, NextFunction } from "express";

export function requirePermission(action: string, resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.supabase || !req.membership) {
      return res
        .status(500)
        .json({ error: "requirePermission ran before resolveTenant" });
    }

    const { data, error } = await req.supabase
      .from("role_permissions")
      .select("permission_id, permissions!inner(action, resource)")
      .eq("role_id", req.membership.roleId)
      .eq("permissions.action", action)
      .eq("permissions.resource", resource)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: "Permission check failed" });
    }

    if (!data) {
      return res.status(403).json({
        error: `Missing permission: ${action}:${resource}`,
      });
    }

    return next();
  };
}
