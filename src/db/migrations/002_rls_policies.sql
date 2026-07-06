alter table projects enable row level security;

create policy "tenant_isolation_select_projects"
on projects
for select
using (
  exists (
    select 1
    from memberships m
    where m.organization_id = projects.organization_id
      and m.user_id = auth.uid()
  )
);