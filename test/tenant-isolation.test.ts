// tests/tenant-isolation.test.ts
import request from "supertest";
import app from "../src/app";
import { createTestUser, loginTestUser, deleteTestUser } from "./helpers/auth";

describe("Tenant isolation", () => {
  const runId = Date.now(); // unique per test run
  const emailA = `test-org-a-${runId}@example.com`;
  const emailB = `test-org-b-${runId}@example.com`;

  let userAId: string, userBId: string;
  let tokenA: string, tokenB: string;
  let orgAId: string, orgBId: string;

  beforeAll(async () => {
    const userA = await createTestUser(emailA, "TestPass123!");
    const userB = await createTestUser(emailB, "TestPass123!");
    userAId = userA!.id;
    userBId = userB!.id;

    tokenA = await loginTestUser(emailA, "TestPass123!");
    tokenB = await loginTestUser(emailB, "TestPass123!");

    // Each user creates their own org, becoming its admin — real flow, real endpoint.
    const orgAResponse = await request(app)
      .post("/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Test Org A" });
    orgAId = orgAResponse.body.organizationId;

    const orgBResponse = await request(app)
      .post("/organizations")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ name: "Test Org B" });
    orgBId = orgBResponse.body.organizationId;
  }, 20000);
  afterAll(async () => {
    // Guard against undefined IDs if beforeAll partially failed —
    // don't let a broken setup also break cleanup.
    if (userAId) await deleteTestUser(userAId);
    if (userBId) await deleteTestUser(userBId);
  });

  it("blocks a user from accessing an org they are not a member of", async () => {
    const response = await request(app)
      .get("/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Organization-Id", orgBId); // Alice's token, Bob's org

    expect(response.status).toBe(403);
  });

  it("allows a user to access their own org", async () => {
    const response = await request(app)
      .get("/tasks")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("X-Organization-Id", orgAId);

    expect(response.status).toBe(200);
  });
});
