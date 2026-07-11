# SaaS RBAC API

A multi-tenant project management API built to deeply understand how multi-tenancy, authentication vs. authorization, and Role-Based Access Control (RBAC) actually work at the architecture level — not just how to make them appear to work.

Organizations can have multiple members, each with a role (`admin`, `editor`, `viewer`). Roles determine what a member can do to projects and tasks. Every tenant's data is isolated from every other tenant's — enforced at both the application layer and the database layer.

## Table of Contents

- [Core Concepts](#core-concepts)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Security Model](#security-model)
- [Setup](#setup)
- [API Reference](#api-reference)
- [Testing](#testing)
- [Project Structure](#project-structure)

## Core Concepts

This project is built around a few ideas that are easy to state and easy to get wrong in practice:

- **Multi-tenancy**: many organizations share the same database, using a shared-schema model with an `organization_id` column on every tenant-owned table. Isolation is enforced both in application code *and* independently at the database level via Postgres Row-Level Security (RLS) — so a forgotten `WHERE` clause in a future route can't leak data across tenants.

- **Authentication vs. Authorization**: a valid JWT proves *who* you are. It proves nothing about *what org* you're acting in or *what you're allowed to do there*. These are checked by two separate, sequential pieces of middleware, never conflated into one.

- **Permissions as data, not code**: instead of hardcoded `if (role === 'editor')` checks scattered across routes, permissions live in the database as rows (`role → permission` mappings). Adding, removing, or auditing what a role can do is a data change, not a code deploy. One generic middleware (`requirePermission`) enforces this everywhere.

- **Defense in depth**: nearly every write path is protected by two independent layers — an application-level permission check, and a database-level RLS policy. Either one failing alone still leaves the other standing.

## Tech Stack

- **Runtime**: Node.js (TypeScript, strict mode)
- **Framework**: Express
- **Database**: Supabase (Postgres), accessed via `@supabase/supabase-js` — chosen specifically so Row-Level Security could be used as a real enforcement layer, not just application-level checks
- **Testing**: Jest + Supertest (integration tests against the real running app and a real database)

## Architecture

### Request pipeline

Every protected route runs through a chain of single-purpose middleware, each answering exactly one question:

```
apiKeyAuth → authenticate → resolveTenant → requirePermission(action, resource) → route handler
```

| Middleware | Question it answers |
|---|---|
| `apiKeyAuth` | Is there an `X-API-Key` header? If so, resolve org + role directly and skip the next two. |
| `authenticate` | Is this a valid, logged-in user? (JWT verification) |
| `resolveTenant` | Is this user actually a member of the org they claim to be acting in? |
| `requirePermission(action, resource)` | Does this user's role have the specific permission this route requires? |

Two independent credential types converge on the exact same `req.membership` shape (`{ organizationId, roleId, roleName }`), so every route handler and permission check downstream is completely agnostic to whether a human or a machine made the request.

### Dual authentication

- **Human requests** use a Supabase-issued JWT (via `/auth/login`), scoped per-request through a fresh Supabase client carrying that user's token — this is what lets Postgres RLS evaluate `auth.uid()` correctly.
- **Machine requests** (CI pipelines, integrations, scripts) use a long-lived **API key**. The key is never stored in plaintext — only a SHA-256 hash. On each request, the raw key is hashed and looked up; if valid and not revoked, the server mints a short-lived (5 minute), internally-signed JWT carrying a custom `org_id` claim, which RLS policies check as an alternate path alongside the normal membership check.

## Database Schema

```
organizations
    │
    ├── memberships (user_id, organization_id, role_id)   ← role lives HERE, not on the user
    │       └── roles (id, name)                            e.g. admin, editor, viewer
    │               └── role_permissions (role_id, permission_id)
    │                       └── permissions (id, action, resource)   e.g. "create:task"
    │
    ├── projects (organization_id, ...)
    │       └── tasks (organization_id, project_id, ...)
    │
    └── api_keys (organization_id, role_id, key_hash, key_prefix, revoked_at, ...)
```

Key design decisions:

- **Role belongs to the membership, not the user** — a single person can hold different roles in different organizations.
- **`organization_id` is duplicated directly onto every tenant-owned table** (`projects`, `tasks`), even where it's technically reachable via a join (`tasks → projects → organization`). This keeps every tenant-isolation filter and RLS policy a single-column, zero-join condition — reducing the surface area for a forgotten or incorrect join to become a data leak.
- **Permissions are a junction table** (`role_permissions`), not a JSON array on `roles` — this keeps the permission graph fully queryable, auditable, and free of typo-prone string arrays.

## Security Model

### Row-Level Security (RLS)

RLS is enabled on `tasks`, `projects`, `memberships`, and `api_keys`. Postgres fails **closed**: enabling RLS with no matching policy makes a table fully inaccessible, so any gap in policy coverage results in over-restriction, never a leak.

Tenant-isolation policies generally take the shape:

```sql
using (
  exists (
    select 1 from memberships m
    where m.organization_id = <table>.organization_id
      and m.user_id = auth.uid()
  )
  or (auth.jwt() ->> 'org_id')::uuid = <table>.organization_id
)
```

The first branch covers human (JWT) requests; the second covers API-key requests via the custom `org_id` claim. Neither interferes with the other.

### `SECURITY DEFINER` functions

Some operations can't safely be expressed as a plain insert guarded by RLS — for example, creating an organization and its first admin membership must happen atomically, and a user can't be granted a blanket "insert into memberships" policy without opening a privilege-escalation hole. These are implemented as narrow, `SECURITY DEFINER` Postgres functions — trusted, single-purpose bypasses of RLS, rather than a general-purpose one:

- `create_organization_with_admin(org_name)` — atomically creates an org and makes the caller its admin.
- `is_org_admin(org_id)` — used inside RLS policies to check admin status without triggering RLS recursion on `memberships`.

### Database triggers

- **Last-admin protection**: a trigger on `memberships` blocks any update or delete that would leave an organization with zero admins. This is enforced at the database/transaction level specifically to close a race condition an application-level "check then act" guard cannot fully prevent.

### API keys

- Stored as a SHA-256 hash only — the raw key is returned exactly once, at creation, and cannot be retrieved again.
- Scoped to a single organization and role, reusing the same permission system as human users.
- Deliberately **cannot** manage memberships or other API keys — machine credentials are scoped to resources (`projects`, `tasks`), not to the access-control system itself.
- Revocation is soft (`revoked_at` timestamp), not a hard delete, preserving an audit trail.

## Setup

### Prerequisites

- Node.js (v20+; see note on WebSocket support below)
- A Supabase project

### Environment variables

Create a `.env` file (see `.env.example`):

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=       # Legacy HS256 shared secret, from Project Settings → API → JWT Settings
PORT=3000
```

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. It's used only in a small number of deliberate, narrow places (looking up a user by email during an invite, verifying API keys before a user identity exists). Never use it as the default client for handling ordinary requests.

### Install

```powershell
npm install
```

> Node.js < 22 lacks a native `WebSocket` implementation that `@supabase/supabase-js`'s Realtime client expects. This project installs the `ws` package and passes it explicitly as the transport in `src/db/client.ts`.

### Database setup

Run the migration SQL in `src/db/migrations/` against your Supabase project via the SQL Editor (in order):
1. Core schema (`organizations`, `roles`, `permissions`, `role_permissions`, `memberships`, `projects`, `tasks`, `api_keys`)
2. RLS policies for each table
3. `SECURITY DEFINER` functions and triggers
4. Seed data (roles, base permissions, role-permission mappings)

### Run

```powershell
npx ts-node-dev src/server.ts
```

## API Reference

All protected routes require either:
- `Authorization: Bearer <jwt>` + `X-Organization-Id: <org id>`, **or**
- `X-API-Key: <key>` (organization and role are resolved from the key itself)

| Method | Route | Required Permission |
|---|---|---|
| `POST` | `/auth/login` | — |
| `POST` | `/organizations` | — (creates org, caller becomes admin) |
| `GET` | `/organizations/:orgId/members` | member of org (RLS determines visible rows) |
| `POST` | `/organizations/:orgId/members` | `invite:member` |
| `PATCH` | `/organizations/:orgId/members/:membershipId` | `edit:member` |
| `DELETE` | `/organizations/:orgId/members/:membershipId` | `remove:member` |
| `GET` | `/organizations/:orgId/projects` | `view:project` |
| `POST` | `/organizations/:orgId/projects` | `create:project` |
| `PATCH` | `/organizations/:orgId/projects/:projectId` | `edit:project` |
| `DELETE` | `/organizations/:orgId/projects/:projectId` | `delete:project` |
| `GET` | `/tasks` | `view:task` |
| `POST` | `/tasks` | `create:task` |
| `PATCH` | `/tasks/:taskId` | `edit:task` |
| `DELETE` | `/tasks/:taskId` | `delete:task` |
| `POST` | `/organizations/:orgId/api-keys` | `manage:api_key` (human/JWT only) |
| `GET` | `/organizations/:orgId/api-keys` | `manage:api_key` (human/JWT only) |
| `PATCH` | `/organizations/:orgId/api-keys/:keyId/revoke` | `manage:api_key` (human/JWT only) |

### Default role permissions (seeded)

| Role | Projects | Tasks | Members | API Keys |
|---|---|---|---|---|
| **admin** | create, view, edit, delete | create, view, edit, delete | invite, edit, remove | manage |
| **editor** | create, view, edit | create, view, edit, delete | — | — |
| **viewer** | view | view | — | — |

## Testing

Integration tests run against the real Express app and a real Supabase database — not mocks — since the properties being verified (tenant isolation, permission enforcement) only exist at the intersection of application code and RLS.

```powershell
npm test
```

- `test/tenant-isolation.test.ts` — proves a user cannot access an organization they don't belong to, and can access one they do, via the real API.
- `test/rbac.test.ts` — proves role-based permission enforcement: a viewer can read tasks but cannot create them.

Tests create their own users and organizations per run (timestamped, unique emails) and clean up after themselves in `afterAll`, so the suite is repeatable without manual intervention between runs.

## Project Structure

```
src/
├── app.ts                     # Express app setup
├── server.ts                  # Entry point
├── db/
│   ├── client.ts               # Supabase client factory (user-scoped + admin)
│   └── migrations/             # SQL migration files
├── middleware/
│   ├── auth.ts                  # JWT verification
│   ├── tenant.ts                 # Membership resolution
│   ├── permission.ts             # requirePermission(action, resource)
│   ├── apiKeyAuth.ts              # API key authentication
│   ├── asyncHandler.ts            # Wraps async route handlers so thrown errors reach errorHandler
│   └── errors.ts                  # Centralized error-handling middleware
├── utils/
│   └── AppError.ts              # Custom error class carrying an HTTP status code
└── features/
    ├── auth/
    ├── organizations/
    ├── memberships/
    ├── projects/
    ├── tasks/
    └── api-keys/
test/
├── helpers/
│   └── auth.ts                 # Test user creation/login/cleanup utilities
├── tenant-isolation.test.ts
└── rbac.test.ts
```

## What This Project Deliberately Avoids

- No hardcoded role checks (`if role === 'admin'`) anywhere in route logic — every permission check goes through one generic middleware backed by data.
- No trusting client-supplied `organization_id` on writes — it is always derived server-side from the authenticated membership.
- No single point of enforcement — every tenant-isolation and permission boundary is backed by at least two independent layers (application check + RLS, or permission check + trigger).
