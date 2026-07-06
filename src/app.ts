import express from "express";
import { authenticate } from "./middleware/auth";
import { resolveTenant } from "./middleware/tenant";
import { requirePermission } from "./middleware/permission";
import authRoutes from "./features/auth/auth.routes";
import organizationRoutes from "./features/organizations/organizations.routes";
import membershipRoutes from "./features/memberships/membership.routes";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/", organizationRoutes);
app.use("/organizations", membershipRoutes);

// Temporary inline test route — proves the full chain works,
// including RLS, before we build out the real features/ structure.
app.get(
  "/tasks",
  authenticate,
  resolveTenant,
  requirePermission("view", "task"),
  async (req, res) => {
    const { data, error } = await req
      .supabase!.from("tasks")
      .select("*")
      .eq("organization_id", req.membership!.organizationId);

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ tasks: data });
  },
);

app.post(
  "/tasks",
  authenticate,
  resolveTenant,
  requirePermission("create", "task"),
  async (req, res) => {
    const { title, projectId } = req.body;

    const { data, error } = await req
      .supabase!.from("tasks")
      .insert({
        title,
        project_id: projectId,
        organization_id: req.membership!.organizationId,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ task: data });
  },
);

export default app;
