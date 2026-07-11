// tests/rbac.test.ts
import request from "supertest";
import app from "../src/app";
import { createTestUser, loginTestUser, deleteTestUser } from "./helpers/auth";

describe("Role-based permissions", () => {
  const runId = Date.now();
  const adminEmail = `test-rbac-admin-${runId}@example.com`;
  const viewerEmail = `test-rbac-viewer-${runId}@example.com`;
  const password = "TestPass123!";

  let adminId: string, viewerId: string;
  let adminToken: string, viewerToken: string;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    console.time("createUsers");
    const admin = await createTestUser(adminEmail, password);
    const viewer = await createTestUser(viewerEmail, password);
    console.timeEnd("createUsers");
    adminId = admin!.id;
    viewerId = viewer!.id;

    console.time("login");
    adminToken = await loginTestUser(adminEmail, password);
    console.timeEnd("login");

    console.time("createOrg");
    const orgResponse = await request(app)
      .post("/organizations")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: `RBAC Test Org ${runId}` });
    orgId = orgResponse.body.organizationId;
    console.timeEnd("createOrg");

    console.time("invite");
    await request(app)
      .post(`/organizations/${orgId}/members`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Organization-Id", orgId)
      .send({ email: viewerEmail, roleName: "viewer" });
    console.timeEnd("invite");

    console.time("viewerLogin");
    viewerToken = await loginTestUser(viewerEmail, password);
    console.timeEnd("viewerLogin");

    console.time("createProject");
    const projectResponse = await request(app)
      .post(`/organizations/${orgId}/projects`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("X-Organization-Id", orgId)
      .send({ name: "RBAC Test Project" });
    projectId = projectResponse.body.project.id;
    console.timeEnd("createProject");
  }, 60000); // temporarily generous, just to let it finish and show us the timings

  afterAll(async () => {
    if (adminId) await deleteTestUser(adminId);
    if (viewerId) await deleteTestUser(viewerId);
  }, 20000); // afterAll also needs its own explicit timeout

  test("allows a viewer to view tasks", async () => {
    const response = await request(app)
      .get("/tasks")
      .set("Authorization", `Bearer ${viewerToken}`)
      .set("X-Organization-Id", orgId);

    expect(response.status).toBe(200);
  });

  it("blocks a viewer from creating tasks", async () => {
    const response = await request(app)
      .post("/tasks")
      .set("Authorization", `Bearer ${viewerToken}`)
      .set("X-Organization-Id", orgId)
      .send({
        title: "Should not be allowed",
        projectId: projectId,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/permission/i);
  });
});
