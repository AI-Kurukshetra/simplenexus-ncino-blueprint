do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_visit_status') then
    create type public.appointment_visit_status as enum ('not_started', 'in_progress', 'completed');
  end if;
end
$$;

create table if not exists public.appointment_visit_notes (
  appointment_id uuid primary key references public.appointment_requests(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  visit_status public.appointment_visit_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  subjective text not null default '',
  objective text not null default '',
  assessment text not null default '',
  plan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_visit_notes_completed_requires_started
    check (completed_at is null or started_at is not null)
);

create index if not exists appointment_visit_notes_provider_status_idx
  on public.appointment_visit_notes(provider_user_id, visit_status, updated_at desc);

drop trigger if exists appointment_visit_notes_set_updated_at on public.appointment_visit_notes;
create trigger appointment_visit_notes_set_updated_at
before update on public.appointment_visit_notes
for each row execute function public.set_updated_at();

alter table public.appointment_visit_notes enable row level security;

drop policy if exists appointment_visit_notes_select_policy on public.appointment_visit_notes;
create policy appointment_visit_notes_select_policy
  on public.appointment_visit_notes
  for select
  to authenticated
  using (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

drop policy if exists appointment_visit_notes_modify_policy on public.appointment_visit_notes;
create policy appointment_visit_notes_modify_policy
  on public.appointment_visit_notes
  for all
  to authenticated
  using (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    provider_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

grant usage on type public.appointment_visit_status to anon, authenticated, service_role;
grant select, insert, update on table public.appointment_visit_notes to authenticated;
grant all privileges on table public.appointment_visit_notes to service_role;
