// src/features/memberships/memberships.controller.ts
import { Request, Response } from "express";
import { supabaseAdmin } from "../../db/client";

export async function inviteMember(req: Request, res: Response) {
  const { email, roleName } = req.body;
  const organizationId = req.membership!.organizationId;

  if (!email || !roleName) {
    return res.status(400).json({ error: "email and roleName are required" });
  }

  // Step 1: resolve email -> user_id, using the admin client.
  // This is a deliberate, narrow use of service_role — there is no
  // RLS-respecting way to look up an arbitrary user by email, since
  // the invited person has no relationship to this org yet.
  const { data: userList, error: userError } =
    await supabaseAdmin.auth.admin.listUsers();

  if (userError) {
    return res.status(500).json({ error: "Failed to look up user" });
  }

  const invitedUser = userList.users.find((u) => u.email === email);

  if (!invitedUser) {
    return res.status(404).json({ error: "No user found with that email" });
  }

  // Step 2: resolve role name -> role_id, using the CALLER'S scoped
  // client — this is a plain, harmless lookup, no elevated access needed.
  const { data: role, error: roleError } = await req
    .supabase!.from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (roleError || !role) {
    return res.status(400).json({ error: "Invalid role name" });
  }

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

  if (insertError) {
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(201).json({ membership });
}

// src/features/memberships/memberships.controller.ts

export async function changeRole(req: Request, res: Response) {
  const { membershipId } = req.params;
  const { roleName } = req.body;

  const { data: role, error: roleError } = await req
    .supabase!.from("roles")
    .select("id")
    .eq("name", roleName)
    .single();

  if (roleError || !role) {
    return res.status(400).json({ error: "Invalid role name" });
  }

  const { data, error } = await req
    .supabase!.from("memberships")
    .update({ role_id: role.id })
    .eq("id", membershipId)
    .select()
    .single();

  if (error) {
    // Will include our trigger's exception message if it's the last admin.
    return res.status(400).json({ error: error.message });
  }

  return res.json({ membership: data });
}

export async function removeMember(req: Request, res: Response) {
  const { membershipId } = req.params;

  const { data, error } = await req
    .supabase!.from("memberships")
    .delete()
    .eq("id", membershipId)
    .select();

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    return res
      .status(404)
      .json({ error: "Membership not found or you lack access to delete it" });
  }

  return res.status(204).send();
}
