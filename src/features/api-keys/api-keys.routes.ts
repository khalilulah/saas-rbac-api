import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { resolveTenant } from "../../middleware/tenant";
import { createApiKey } from "./api-keys.controller";

const router = Router({ mergeParams: true });

router.post(
  "/:orgId/api-keys",
  authenticate,
  resolveTenant,
  requirePermission("manage", "api_key"),
  createApiKey,
);

export default router;
