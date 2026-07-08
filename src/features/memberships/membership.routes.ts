import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { resolveTenant } from "../../middleware/tenant";
import {
  changeRole,
  inviteMember,
  listMembers,
  removeMember,
} from "./memberships.controller";

const router = Router();

router.post(
  "/:orgId/members",
  authenticate,
  resolveTenant,
  requirePermission("invite", "member"),
  inviteMember,
);

router.patch(
  "/:orgId/members/:membershipId",
  authenticate,
  resolveTenant,
  requirePermission("edit", "member"),
  changeRole,
);

router.delete(
  "/:orgId/members/:membershipId",
  authenticate,
  resolveTenant,
  requirePermission("remove", "member"),
  removeMember,
);
router.get("/:orgId/members", authenticate, resolveTenant, listMembers);

export default router;
