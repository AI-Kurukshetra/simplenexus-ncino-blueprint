do $$
begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type public.invoice_status as enum ('draft', 'issued', 'paid', 'void');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'cancelled');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'manual_card',
      'manual_cash',
      'manual_bank_transfer',
      'placeholder_gateway'
    );
  end if;
end
$$;

create table if not exists public.invoices (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  appointment_request_id uuid references public.appointment_requests(id) on delete set null,
  invoice_number text not null,
  currency text not null default 'USD',
  status public.invoice_status not null default 'issued',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  issued_at timestamptz not null default now(),
  due_at timestamptz,
  paid_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists public.invoice_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text,
  description text not null,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  line_total_cents integer not null check (line_total_cents >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  status public.payment_status not null default 'succeeded',
  payment_method public.payment_method not null default 'manual_card',
  external_payment_id text,
  idempotency_key text,
  note text,
  collected_by_user_id uuid references auth.users(id) on delete set null,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists payments_org_idempotency_unique
  on public.payments(organization_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.insurance_plans (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  payer_name text not null,
  member_id text,
  group_number text,
  plan_type text,
  subscriber_name text,
  relationship_to_subscriber text,
  coverage_status text not null default 'active',
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, patient_user_id)
);

create table if not exists public.insurance_verification_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  insurance_plan_id uuid not null references public.insurance_plans(id) on delete cascade,
  verification_source text not null default 'manual_placeholder',
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'pending',
  response_summary jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  claim_number text not null,
  status text not null default 'draft',
  payer_name text,
  total_cents integer not null default 0 check (total_cents >= 0),
  submitted_at timestamptz,
  adjudicated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, claim_number)
);

create table if not exists public.claim_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  claim_id uuid not null references public.claims(id) on delete cascade,
  event_type text not null,
  event_at timestamptz not null default now(),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null
);

create index if not exists invoices_org_status_idx
  on public.invoices(organization_id, status, issued_at desc);
create index if not exists invoices_patient_idx
  on public.invoices(patient_user_id, issued_at desc);
create index if not exists invoice_line_items_invoice_idx
  on public.invoice_line_items(invoice_id);
create index if not exists payments_invoice_idx
  on public.payments(invoice_id, created_at desc);
create index if not exists payments_patient_idx
  on public.payments(patient_user_id, created_at desc);
create index if not exists insurance_plans_org_patient_idx
  on public.insurance_plans(organization_id, patient_user_id);
create index if not exists insurance_verification_events_plan_idx
  on public.insurance_verification_events(insurance_plan_id, requested_at desc);
create index if not exists claims_org_status_idx
  on public.claims(organization_id, status, created_at desc);
create index if not exists claim_events_claim_idx
  on public.claim_events(claim_id, event_at desc);

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

drop trigger if exists insurance_plans_set_updated_at on public.insurance_plans;
create trigger insurance_plans_set_updated_at
before update on public.insurance_plans
for each row execute function public.set_updated_at();

drop trigger if exists claims_set_updated_at on public.claims;
create trigger claims_set_updated_at
before update on public.claims
for each row execute function public.set_updated_at();

alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.insurance_plans enable row level security;
alter table public.insurance_verification_events enable row level security;
alter table public.claims enable row level security;
alter table public.claim_events enable row level security;

create policy invoices_select_policy
  on public.invoices
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy invoices_modify_policy
  on public.invoices
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy invoice_line_items_select_policy
  on public.invoice_line_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.invoices i
      where i.id = invoice_id
        and (
          i.patient_user_id = auth.uid()
          or (public.has_org_access(i.organization_id) and public.is_admin_actor())
        )
    )
  );

create policy invoice_line_items_modify_policy
  on public.invoice_line_items
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy payments_select_policy
  on public.payments
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy payments_insert_policy
  on public.payments
  for insert
  to authenticated
  with check (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy payments_update_policy
  on public.payments
  for update
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy insurance_plans_select_policy
  on public.insurance_plans
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy insurance_plans_modify_policy
  on public.insurance_plans
  for all
  to authenticated
  using (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  )
  with check (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy insurance_verification_events_select_policy
  on public.insurance_verification_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.insurance_plans p
      where p.id = insurance_plan_id
        and (
          p.patient_user_id = auth.uid()
          or (public.has_org_access(p.organization_id) and public.is_admin_actor())
        )
    )
  );

create policy insurance_verification_events_modify_policy
  on public.insurance_verification_events
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy claims_select_policy
  on public.claims
  for select
  to authenticated
  using (
    patient_user_id = auth.uid()
    or (public.has_org_access(organization_id) and public.is_admin_actor())
  );

create policy claims_modify_policy
  on public.claims
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

create policy claim_events_select_policy
  on public.claim_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.claims c
      where c.id = claim_id
        and (
          c.patient_user_id = auth.uid()
          or (public.has_org_access(c.organization_id) and public.is_admin_actor())
        )
    )
  );

create policy claim_events_modify_policy
  on public.claim_events
  for all
  to authenticated
  using (public.has_org_access(organization_id) and public.is_admin_actor())
  with check (public.has_org_access(organization_id) and public.is_admin_actor());

grant select, insert, update, delete on table
  public.invoices,
  public.invoice_line_items,
  public.payments,
  public.insurance_plans,
  public.insurance_verification_events,
  public.claims,
  public.claim_events
to authenticated;

grant all privileges on table
  public.invoices,
  public.invoice_line_items,
  public.payments,
  public.insurance_plans,
  public.insurance_verification_events,
  public.claims,
  public.claim_events
to service_role;
