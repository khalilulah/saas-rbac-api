// src/features/projects/projects.routes.ts
import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { resolveTenant } from "../../middleware/tenant";
import { requirePermission } from "../../middleware/permission";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "./projects.controller";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  resolveTenant,
  requirePermission("view", "project"),
  listProjects,
);
router.post(
  "/",
  authenticate,
  resolveTenant,
  requirePermission("create", "project"),
  createProject,
);
router.patch(
  "/:projectId",
  authenticate,
  resolveTenant,
  requirePermission("edit", "project"),
  updateProject,
);
router.delete(
  "/:projectId",
  authenticate,
  resolveTenant,
  requirePermission("delete", "project"),
  deleteProject,
);

export default router;
