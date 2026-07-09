import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { resolveTenant } from "../../middleware/tenant";
import { createApiKey, listApiKeys, revokeApiKey } from "./api-keys.controller";

const router = Router({ mergeParams: true });

router.post(
  "/:orgId/api-keys",
  authenticate,
  resolveTenant,
  requirePermission("manage", "api_key"),
  createApiKey,
);

router.get(
  "/:orgId/api-keys",
  authenticate,
  resolveTenant,
  requirePermission("manage", "api_key"),
  listApiKeys,
);

router.patch(
  "/:orgId/api-keys/:keyId/revoke",
  authenticate,
  resolveTenant,
  requirePermission("manage", "api_key"),
  revokeApiKey,
);

export default router;
