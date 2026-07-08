import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requirePermission } from "../../middleware/permission";
import { resolveTenant } from "../../middleware/tenant";
import { createTask, deleteTask, getTask, updateTask } from "./task.controller";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  resolveTenant,
  requirePermission("view", "task"),
  getTask,
);

router.post(
  "/",
  authenticate,
  resolveTenant,
  requirePermission("create", "task"),
  createTask,
);

router.patch(
  "/:taskId",
  authenticate,
  resolveTenant,
  requirePermission("edit", "task"),
  updateTask,
);
router.delete(
  "/:taskId",
  authenticate,
  resolveTenant,
  requirePermission("delete", "task"),
  deleteTask,
);

export default router;
