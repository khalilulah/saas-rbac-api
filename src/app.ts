import express from "express";

import authRoutes from "./features/auth/auth.routes";
import organizationRoutes from "./features/organizations/organizations.routes";
import membershipRoutes from "./features/memberships/membership.routes";
import apiRoutes from "./features/api-keys/api-keys.routes";
import projectsRoutes from "./features/projects/projects.routes";
import taskRoutes from "./features/tasks/task.routes";

const app = express();
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/", organizationRoutes);
app.use("/organizations", membershipRoutes);
app.use("/organizations", apiRoutes);

app.use("/organizations/:orgId/projects", projectsRoutes);
app.use("/tasks", taskRoutes);

export default app;
