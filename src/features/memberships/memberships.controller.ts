// src/features/memberships/memberships.controller.ts
import { Request, Response } from "express";
import { supabaseAdmin } from "../../db/client";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const inviteMember = asyncHandler(
  async (req: Request, res: Response) => {
    const { email, roleName } = req.body;
    const organizationId = req.membership!.organizationId;

    if (!email || !roleName) {
      throw new AppError(400, "email and roleName are required");
    }

    // Step 1: resolve email -> user_id, using the admin client.
    // This is a deliberate, narrow use of service_role — there is no
    // RLS-respecting way to look up an arbitrary user by email, since
    // the invited person has no relationship to this org yet.
    const { data: userList, error: userError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      throw new AppError(500, "Failed to look up user");
    }

    const invitedUser = userList.users.find((u) => u.email === email);

    if (!invitedUser) {
      throw new AppError(404, "No user found with that email");
    }

    // Step 2: resolve role name -> role_id, using the CALLER'S scoped
    // client — this is a plain, harmless lookup, no elevated access needed.
    const { data: role, error: roleError } = await req
      .supabase!.from("roles")
      .select("id")
      .eq("name", roleName)
      .single();

    if (roleError || !role) throw new AppError(400, roleError.message);

    // Step 3: insert the membership using the CALLER'S scoped client,
    // NOT supabaseAdmin — we want RLS's insert policy on memberships
    // to still apply here, so this deliberately stays inside the
    // regular permission system, not the admin bypass.
    const { data: membership, error: insertError } = await req
      .supabase!.from("memberships")
      .insert({
        user_id: invitedUser.id,
        organization_id: organizationId,
        role_id: role.id,
      })
      .select()
      .single();

    if (insertError) throw new AppError(500, insertError.message);

    return res.status(201).json({ membership });
  },
);

// src/features/memberships/memberships.controller.ts

export const changeRole = asyncHandler(async (req: Request, res: Response) => {
  const { membershipId } = req.params;
  const { roleName } = req.body;

  if (!roleName) {
    throw new AppError(400, "rolename required");
  }

  const { data: role, error: roleError } = await req
    .supabase!.from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (roleError || !role) {
    throw new AppError(400, "Invalid role name");
  }

  const { data, error } = await req
    .supabase!.from("memberships")
    .update({ role_id: role.id })
    .eq("id", membershipId)
    .select()
    .single();

  if (error) throw new AppError(500, error.message);

  return res.json({ membership: data });
});

export const removeMember = asyncHandler(
  async (req: Request, res: Response) => {
    const { membershipId } = req.params;

    const { data, error } = await req
      .supabase!.from("memberships")
      .delete()
      .eq("id", membershipId)
      .select();

    if (error) throw new AppError(500, error.message);

    if (!data || data.length === 0) {
      throw new AppError(
        404,
        "Membership not found or you lack access to delete it",
      );
    }

    return res.status(204).send();
  },
);

// src/features/memberships/memberships.controller.ts

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.membership!.organizationId;

  const { data, error } = await req
    .supabase!.from("memberships")
    .select("id, user_id, role_id, roles(name)")
    .eq("organization_id", organizationId);

  if (error) throw new AppError(500, error.message);

  return res.json({ members: data });
});
