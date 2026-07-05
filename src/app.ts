import express from "express";
import { authenticate } from "./middleware/auth";
import { resolveTenant } from "./middleware/tenant";

const app = express();
app.use(express.json());

// Temporary inline test route — proves the full chain works,
// including RLS, before we build out the real features/ structure.
app.get("/tasks", authenticate, resolveTenant, async (req, res) => {
  const { data, error } = await req
    .supabase!.from("tasks")
    .select("*")
    .eq("organization_id", req.membership!.organizationId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ organization: req.membership, tasks: data });
});

export default app;
