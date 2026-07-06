create or replace function create_organization_with_admin(org_name text)
returns table (organization_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org_id uuid;
  admin_role_id uuid;
begin
  -- Look up the admin role once; assumes roles are seeded, not user-created.
  select id into admin_role_id from roles where name = 'admin';

  if admin_role_id is null then
    raise exception 'Admin role not found — check roles table seeding';
  end if;

  -- Step 1: create the organization.
  insert into organizations (name)
  values (org_name)
  returning id into new_org_id;

  -- Step 2: make the calling user its admin.
  -- auth.uid() still works inside a SECURITY DEFINER function —
  -- it reads the JWT of whoever is calling, not the function owner.
  insert into memberships (user_id, organization_id, role_id)
  values (auth.uid(), new_org_id, admin_role_id);

  return query select new_org_id;
end;
$$;