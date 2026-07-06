import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { createOrganization } from "./organizations.controller";

const router = Router();

router.post("/organizations", authenticate, createOrganization);

export default router;
