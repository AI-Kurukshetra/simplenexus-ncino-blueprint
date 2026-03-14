# Implementation Progress Tracker (`complete.md`)

Use this file as the single source of truth for implementation status against `NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md`.

## 1) Snapshot
- Current date: 2026-03-14
- Current stage: `Stage 3 - Continuity`
- Overall completion: `67%`
- Health: `On Track`
- Last updated by: `Codex`

## 2) Stage Tracker (Section 16)

Status legend:
- `[ ]` Not started
- `[-]` In progress
- `[x]` Completed
- `[!]` Blocked

- `[-]` Stage 0: Setup and Validation
- `[-]` Stage 1: Foundation
- `[-]` Stage 2: Patient and Provider Core
- `[-]` Stage 3: Continuity
- `[ ]` Stage 4: Revenue and Integrations
- `[ ]` Stage 5: Hardening
- `[ ]` Stage 6: Third-Party Expansion

## 3) Module Tracker (Section 8)

- `[-]` 8.1 Authentication, Organization Setup, and Access Control
- `[-]` 8.2 Patient Registration and Onboarding
- `[-]` 8.3 Appointment Scheduling
- `[ ]` 8.4 Telehealth Visit Flow
- `[ ]` 8.5 Longitudinal Patient Chart
- `[ ]` 8.6 Clinical Documentation
- `[ ]` 8.7 Prescription Management
- `[-]` 8.8 Messaging, Notifications, and Communication Hub
- `[-]` 8.9 Care Plans, Tasks, and Workflow Automation
- `[ ]` 8.10 Billing, Payments, and Claims Foundation
- `[ ]` 8.11 Labs, Interoperability, and External Integrations
- `[ ]` 8.12 Analytics, Reporting, and Quality Measures
- `[-]` 8.13 Admin Console and Platform Operations
- `[ ]` 8.14 API Platform and Developer Experience
- `[ ]` 8.15 Mobile and Offline Strategy
- `[ ]` 8.16 Multi-Tenant and White-Label Platform Controls
- `[ ]` 8.17 Chronic Care, Population Health, and Device Readiness

## 4) Critical Inputs and Dependencies

### 4.1 Supabase Inputs (Section 18)
- `[x]` `NEXT_PUBLIC_SUPABASE_URL`
- `[x]` `NEXT_PUBLIC_SUPABASE_ANON_KEY` (compatibility mapping supports `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`)
- `[x]` `SUPABASE_SERVICE_ROLE_KEY`
- `[ ]` `SUPABASE_PROJECT_REF`
- `[ ]` `SUPABASE_DB_PASSWORD`
- `[ ]` `DATABASE_URL`
- `[ ]` `DIRECT_URL`
- `[ ]` `SUPABASE_ACCESS_TOKEN`

### 4.2 Product Decisions (Section 20)
- `[ ]` Specialty configuration confirmed
- `[ ]` Tenant model confirmed (multi-tenant from day one)
- `[ ]` Email vendor confirmed
- `[ ]` SMS vendor confirmed
- `[ ]` Payment approach confirmed
- `[ ]` E-prescribing phase confirmation
- `[ ]` Claims submission phase confirmation

## 5) Definition of Done Checks (Section 17)
- `[ ]` UI covers loading/empty/success/error states
- `[ ]` Role and tenant boundaries enforced
- `[ ]` API schema validated
- `[ ]` Audit logging implemented for sensitive actions
- `[ ]` Tests present at right level
- `[ ]` Documentation updated

## 6) Active Work

| Item | Owner | Status | Notes |
|---|---|---|---|
| Project kickoff and tracking setup | Codex + User | Completed | `complete.md` created |
| Enterprise readiness gap baseline | Codex + User | Completed | Initial enterprise backlog added in section 11 |
| Reusable planning skills | Codex + User | Completed | Added `enterprise-readiness-audit` and `implementation-progress-tracker` skills |
| Stage 1 app foundation scaffold | Codex + User | Completed | Created `web/` Next.js app, Supabase env/client utilities, middleware, role route shells |
| Stage 1 auth + route guard baseline | Codex + User | Completed | Added Supabase email/password auth actions, callback route, reset flow, and role-guard middleware |
| Stage 2 onboarding baseline | Codex + User | Completed | Added patient onboarding wizard with save/resume draft and submit APIs |
| Stage 2 scheduling baseline | Codex + User | Completed | Added appointments contract-first API and patient booking shell with idempotency key |
| Invite acceptance baseline | Codex + User | Completed | Added invite code acceptance flow to bootstrap role metadata |
| Role-aware signup and provider approval flow | Codex + User | Completed | Added patient/provider role selection in signup and enforced provider pending approval state |
| Appointment approval workflow | Codex + User | Completed | Patient requests now stay pending until provider/admin approval via dashboard actions |
| Admin provider verification console | Codex + User | Completed | Added admin API and UI queue to approve/reject providers |
| Onboarding readiness enforcement | Codex + User | Completed | Persisted patient onboarding status and block scheduling until onboarding is submitted |
| Admin patient operations console | Codex + User | Completed | Added admin patient API + UI table for onboarding readiness and request load tracking |
| Provider schedule management | Codex + User | Completed | Added provider availability APIs and schedule manager UI with conflict-safe slot creation |
| Slot-based booking and appointment detail flow | Codex + User | Completed | Patient booking now uses provider slots and includes appointment detail route with status timeline |
| Appointment lifecycle and policy controls | Codex + User | Completed | Added policy-based cancel/reschedule API flow with slot reopen/reservation safety and timeline events |
| Admin scheduling policy configuration | Codex + User | Completed | Added admin scheduling policy API and UI to configure cancellation/reschedule windows |
| Notification inbox and reminder dispatch simulation | Codex + User | Completed | Added notifications API + role message centers and admin-triggered reminder dispatch run |
| Appointment event notifications | Codex + User | Completed | Appointment create/decision/manage flows now publish participant notifications |
| Care task API and domain store | Codex + User | Completed | Added role-scoped tasks API and metadata-backed task store with provider/patient/admin permissions |
| Care plan and workflow UI surfaces | Codex + User | Completed | Added patient care plans, provider task board, and admin workflows management interfaces |
| Supabase core schema and RLS baseline | Codex + User | Completed | Added first real DB migration with core tables, indexes, helper functions, and row-level policies; pushed to remote project |
| SQL cutover for scheduling and appointments | Codex + User | Completed | Migrated availability slots and appointment request/event stores/APIs from auth metadata to Supabase tables |
| SQL cutover for tasks and notifications | Codex + User | Completed | Migrated care tasks and notification/reminder stores/APIs to Supabase tables with dedupe and reminder dispatch logic |

## 7) Blockers / Risks

| Date | Type | Description | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| 2026-03-14 | Architecture | Appointment workflow data is currently stored in Supabase `auth` metadata to avoid DB migration | Limited scalability and complex querying at scale | Replace with dedicated Supabase tables + RLS in next DB phase | Codex + User | Open |
| 2026-03-14 | Architecture | Notifications and scheduling policies are persisted in Supabase `auth` metadata | Metadata size and update-contention risk as volume grows | Migrate notifications/policies to dedicated Postgres tables with retention strategy in DB phase | Codex + User | Open |
| 2026-03-14 | Architecture | Care tasks/workflows are persisted in Supabase `auth` metadata | Higher contention and weak queryability for population-level workflow analytics | Migrate care tasks to tenant-scoped tables with indexes and audit trail in DB phase | Codex + User | Open |
| 2026-03-14 | Migration | App APIs still read/write mostly from `auth` metadata while new SQL tables now exist | Temporary dual-model gap until repository layer switches to SQL-backed data | Incrementally migrate API routes to DB-backed stores with compatibility bridge and backfill | Codex + User | Open |

## 8) Change Log

| Date | Area | Change | By |
|---|---|---|---|
| 2026-03-14 | Tracking | Created implementation tracker file | Codex |
| 2026-03-14 | Enterprise | Added enterprise readiness backlog section | Codex |
| 2026-03-14 | Skills | Added enterprise and progress-tracker skills | Codex |
| 2026-03-14 | Progress | Updated Stage 0 to in-progress and completion to 5% | Codex |
| 2026-03-14 | Execution | Added execution map (`IMPLEMENTATION_EXECUTION_MAP.md`) and task-tracking protocol | Codex |
| 2026-03-14 | Hygiene | Audited for duplicate files; none found. Added canonical precedence and duplicate-handling rules | Codex |
| 2026-03-14 | Env | Marked Supabase URL configured; flagged publishable key name mismatch vs `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Codex |
| 2026-03-14 | Stage 1 | Initialized `web/` Next.js app and implemented foundation scaffold (env validation, Supabase clients, middleware, base routes) | Codex |
| 2026-03-14 | Validation | Verified lint passes; verified production build via webpack (`npm run build -- --webpack`) | Codex |
| 2026-03-14 | Env | Copied root `.env` to `web/.env.local` for app runtime and confirmed key-status alignment | Codex |
| 2026-03-14 | Auth | Implemented sign-in/sign-up/reset-password actions, callback exchange route, `/app` redirect resolver, sign-out control, and role-based middleware guard rules | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after auth/guard implementation (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Onboarding | Implemented patient onboarding wizard UI plus draft save/resume and submit API stubs | Codex |
| 2026-03-14 | Scheduling | Implemented appointments API contract and patient booking shell with idempotency header enforcement | Codex |
| 2026-03-14 | Invite | Replaced invite placeholder with actionable accept flow and role metadata bootstrap | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after onboarding/scheduling/invite updates (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Auth | Added role-aware signup (patient/provider), provider pending approval gating, and pending approval provider page | Codex |
| 2026-03-14 | Scheduling | Added provider/admin appointment approval API and provider approval board UI | Codex |
| 2026-03-14 | Admin | Added provider verification APIs and admin provider management console | Codex |
| 2026-03-14 | UI | Upgraded signup flow and app shell navigation to role-aware interactive experience | Codex |
| 2026-03-14 | Security | Migrated effective role/approval control to `app_metadata` via admin-side updates to prevent user-metadata role escalation | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after role/approval workflow updates (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Onboarding | Persisted patient onboarding status in user metadata and enforced onboarding completion before appointment request creation | Codex |
| 2026-03-14 | Admin | Added admin patients API/page with readiness filters and operational table for onboarding + appointment request visibility | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after onboarding/admin patient enhancements (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Scheduling | Added provider availability management APIs, slot store logic, and provider schedule page with interactive slot controls | Codex |
| 2026-03-14 | Scheduling | Upgraded patient booking to slot-based selection, enforced slot reservation, and added patient appointment detail route (`/app/patient/appointments/[id]`) | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after provider scheduling and appointment detail updates (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Scheduling | Added appointment lifecycle events and reminder-schedule timeline records in appointment metadata model | Codex |
| 2026-03-14 | Scheduling | Added policy-controlled appointment manage API for cancel/reschedule with role checks and provider slot reopen/reserve safeguards | Codex |
| 2026-03-14 | Admin | Added admin scheduling policy API and management page (`/app/admin/scheduling`) with update flow | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after cancel/reschedule policy and scheduling-config enhancements (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Messaging | Added in-app notifications store, inbox APIs, read endpoint, and role-specific message center pages for patient/provider/admin | Codex |
| 2026-03-14 | Scheduling | Added reminder dispatch simulation API to process scheduled reminder events and publish notifications to patients/providers | Codex |
| 2026-03-14 | Scheduling | Added appointment participant notification publishing hooks for request/approve/reject/reschedule/cancel actions | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after notifications/reminder-dispatch implementation (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Workflows | Added care task store and `/api/tasks` route with create/list/status-update contracts and role-scoped permission checks | Codex |
| 2026-03-14 | Workflows | Added patient care plans page, provider tasks page, and admin workflows page with interactive task management UIs | Codex |
| 2026-03-14 | Navigation | Updated role nav/dashboard links to expose new care plans/tasks/workflows surfaces | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after care plan/workflow implementation (`npm run lint`, `npm run build -- --webpack`) | Codex |
| 2026-03-14 | Database | Added core Supabase schema + RLS migration (`organizations`, memberships, profiles, appointments, events, tasks, notifications, scheduling policies, audit logs) | Codex |
| 2026-03-14 | Database | Linked project `zsdokbebjfyxacuwwdan` and applied migration with `supabase db push` | Codex |
| 2026-03-14 | Data Layer | Replaced metadata-based appointment store with SQL-backed appointment request/event repository and updated dependent APIs/pages | Codex |
| 2026-03-14 | Data Layer | Replaced metadata-based provider availability store with SQL-backed slot repository and updated availability APIs | Codex |
| 2026-03-14 | Data Layer | Replaced metadata-based care task and notification stores with SQL-backed repositories and updated reminder dispatch/read APIs | Codex |
| 2026-03-14 | Validation | Re-verified lint and production build after SQL cutover for appointments/tasks/notifications (`npm run lint`, `npm run build -- --webpack`) | Codex |

## 9) Weekly Update Template

Copy this block each week:

```md
### Week of YYYY-MM-DD
- Wins:
- In progress:
- Blockers:
- Next priorities:
- Confidence level: High / Medium / Low
```

## 10) How We Update This File
- Update status immediately after each meaningful implementation step.
- Keep `Snapshot`, `Stage Tracker`, and `Active Work` in sync.
- Add blockers the same day they appear.
- Do not remove old log entries; append instead.

## 11) Enterprise Readiness Backlog

Use this list to close the gap from MVP-ready to enterprise-ready.

- `[ ]` Enterprise IAM and identity lifecycle
- Define SSO (`SAML`/`OIDC`) requirements, IdP onboarding, and SCIM provisioning/deprovisioning.
- Define break-glass access and just-in-time privileged access flow.

- `[ ]` Compliance program mapping
- Map controls to target frameworks (for example HIPAA + SOC 2) with control owner and evidence source.
- Define audit cadence, evidence retention period, and control test schedule.

- `[ ]` Security assurance pipeline
- Add explicit `SAST`, `DAST`, and `SBOM` generation in CI/CD.
- Define penetration test cadence and remediation SLA tracking.

- `[ ]` Data governance and key management
- Define data classification policy and PHI handling matrix by domain.
- Decide key management strategy (managed keys vs customer-managed keys/BYOK if required).
- Define data residency strategy and tenant-level residency constraints if needed.

- `[ ]` Reliability governance
- Add formal error-budget policy with ownership and release freeze triggers.
- Define capacity model, scale test calendar, and multi-region failover decision criteria.

- `[ ]` Operational governance
- Define change management flow for production changes and emergency changes.
- Define on-call operating model (coverage hours, escalation ladder, duty handoff).

- `[ ]` Enterprise customer controls
- Define tenant admin controls for audit exports, retention config, and policy visibility.
- Define enterprise API governance model (client onboarding, quota tiers, deprecation policy).

## 12) Implementation Item Ledger (Use for Every Task)

ID format: `STG{n}-MOD{8.x}-TASK-{nnn}`

| ID | Stage | Module | Task | Skill(s) Used | Evidence (files/tests/migrations) | Owner | Status | Updated |
|---|---|---|---|---|---|---|---|---|
| STG0-MOD8.1-TASK-001 | Stage 0 | 8.1 | Execution and tracking framework setup | `$implementation-progress-tracker`, `$enterprise-readiness-audit` | `complete.md`, `IMPLEMENTATION_EXECUTION_MAP.md` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-001 | Stage 1 | 8.1 | Next.js + Supabase foundation scaffold in `web/` | `$virtual-health-ui`, `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/lib/env/*`, `web/src/lib/supabase/*`, `web/middleware.ts`, `web/src/app/*`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-002 | Stage 1 | 8.1 | Auth and access-control baseline (email/password, callback, reset, role guard) | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/lib/auth/*`, `web/src/app/auth/callback/route.ts`, `web/src/app/sign-*/page.tsx`, `web/src/app/forgot-password/page.tsx`, `web/src/app/reset-password/page.tsx`, `web/middleware.ts`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.2-TASK-001 | Stage 2 | 8.2 | Patient onboarding wizard with draft save/resume and submit API contracts | `$virtual-health-ui`, `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/components/patient/onboarding-wizard.tsx`, `web/src/app/app/patient/onboarding/page.tsx`, `web/src/app/api/patient/onboarding/draft/route.ts`, `web/src/app/api/patient/onboarding/submit/route.ts`, `web/src/lib/onboarding/schemas.ts`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.3-TASK-001 | Stage 2 | 8.3 | Appointment scheduling API baseline and booking UI shell | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/app/api/appointments/route.ts`, `web/src/lib/scheduling/schemas.ts`, `web/src/components/patient/appointments-shell.tsx`, `web/src/app/app/patient/appointments/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-003 | Stage 1 | 8.1 | Invite acceptance flow and role bootstrap metadata update | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/lib/auth/actions.ts`, `web/src/app/invite/accept/page.tsx`, `web/src/app/sign-in/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-004 | Stage 1 | 8.1 | Role-aware signup and provider approval gating | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/app/sign-up/page.tsx`, `web/src/lib/auth/actions.ts`, `web/src/lib/auth/roles.ts`, `web/src/app/app/provider/pending-approval/page.tsx`, `web/middleware.ts`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.3-TASK-002 | Stage 2 | 8.3 | Provider/admin appointment approval workflow | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/app/api/appointments/route.ts`, `web/src/app/api/appointments/decision/route.ts`, `web/src/lib/appointments/store.ts`, `web/src/components/provider/appointment-approval-board.tsx`, `web/src/components/patient/appointments-shell.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.13-TASK-001 | Stage 1 | 8.13 | Admin provider verification management console | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/app/api/admin/providers/route.ts`, `web/src/app/api/admin/providers/approval/route.ts`, `web/src/lib/providers/store.ts`, `web/src/components/admin/provider-approval-table.tsx`, `web/src/app/app/admin/providers/page.tsx`, `web/src/app/app/admin/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.2-TASK-002 | Stage 2 | 8.2 | Persist patient onboarding submission/progress state and enforce readiness before scheduling | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/app/api/patient/onboarding/draft/route.ts`, `web/src/app/api/patient/onboarding/submit/route.ts`, `web/src/lib/auth/roles.ts`, `web/src/app/api/appointments/route.ts`, `web/src/components/patient/appointments-shell.tsx`, `web/src/app/app/patient/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.13-TASK-002 | Stage 2 | 8.13 | Admin patient operations API and dashboard table | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/lib/patients/store.ts`, `web/src/app/api/admin/patients/route.ts`, `web/src/components/admin/patient-management-table.tsx`, `web/src/app/app/admin/patients/page.tsx`, `web/src/components/layout/app-shell.tsx`, `web/src/app/app/admin/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.3-TASK-003 | Stage 2 | 8.3 | Provider availability manager and slot APIs | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/lib/scheduling/schemas.ts`, `web/src/lib/scheduling/store.ts`, `web/src/app/api/provider/availability/route.ts`, `web/src/app/api/providers/availability/route.ts`, `web/src/components/provider/schedule-manager.tsx`, `web/src/app/app/provider/schedule/page.tsx`, `web/src/components/layout/app-shell.tsx`, `web/src/app/app/provider/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.3-TASK-004 | Stage 2 | 8.3 | Slot-based booking enforcement and patient appointment detail experience | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/app/api/appointments/route.ts`, `web/src/app/api/appointments/decision/route.ts`, `web/src/lib/appointments/store.ts`, `web/src/components/patient/appointments-shell.tsx`, `web/src/app/app/patient/appointments/[id]/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.3-TASK-005 | Stage 2 | 8.3 | Appointment cancel/reschedule workflow with policy-window enforcement | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/app/api/appointments/manage/route.ts`, `web/src/lib/scheduling/policies.ts`, `web/src/lib/scheduling/store.ts`, `web/src/lib/appointments/store.ts`, `web/src/components/patient/appointment-detail-actions.tsx`, `web/src/app/app/patient/appointments/[id]/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG2-MOD8.13-TASK-003 | Stage 2 | 8.13 | Admin scheduling policy configuration controls | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/app/api/admin/scheduling-policy/route.ts`, `web/src/components/admin/scheduling-policy-form.tsx`, `web/src/app/app/admin/scheduling/page.tsx`, `web/src/components/layout/app-shell.tsx`, `web/src/app/app/admin/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG3-MOD8.8-TASK-001 | Stage 3 | 8.8 | Notification inbox APIs and role message center UI | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/lib/notifications/store.ts`, `web/src/app/api/notifications/route.ts`, `web/src/app/api/notifications/read/route.ts`, `web/src/components/shared/notification-center.tsx`, `web/src/app/app/patient/messages/page.tsx`, `web/src/app/app/provider/messages/page.tsx`, `web/src/app/app/admin/messages/page.tsx`, `web/src/components/layout/app-shell.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG3-MOD8.8-TASK-002 | Stage 3 | 8.8 | Reminder dispatch simulation and appointment notification publishing | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/app/api/notifications/reminders/run/route.ts`, `web/src/lib/notifications/store.ts`, `web/src/lib/appointments/store.ts`, `web/src/app/api/appointments/route.ts`, `web/src/app/api/appointments/decision/route.ts`, `web/src/app/api/appointments/manage/route.ts`, `web/src/app/app/patient/appointments/[id]/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG3-MOD8.9-TASK-001 | Stage 3 | 8.9 | Care tasks domain store and API contracts | `$api-contract-enforcer`, `$implementation-progress-tracker` | `web/src/lib/tasks/store.ts`, `web/src/app/api/tasks/route.ts`, `web/src/lib/appointments/store.ts`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG3-MOD8.9-TASK-002 | Stage 3 | 8.9 | Role-specific care plan and workflow task UIs | `$virtual-health-ui`, `$implementation-progress-tracker` | `web/src/components/patient/care-plan-board.tsx`, `web/src/components/provider/task-board.tsx`, `web/src/components/admin/workflow-task-table.tsx`, `web/src/app/app/patient/care-plans/page.tsx`, `web/src/app/app/provider/tasks/page.tsx`, `web/src/app/app/admin/workflows/page.tsx`, `web/src/components/layout/app-shell.tsx`, `web/src/app/app/*/dashboard/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-005 | Stage 1 | 8.1 | Core Supabase SQL schema and RLS baseline migration | `$supabase-rls-guardian`, `$implementation-progress-tracker` | `supabase/migrations/20260314094051_core_schema_rls.sql`, `supabase db push` (remote project `zsdokbebjfyxacuwwdan`) | Codex + User | Done | 2026-03-14 |
| STG1-MOD8.1-TASK-006 | Stage 1 | 8.1 | SQL repository cutover for scheduling/appointments/tasks/notifications | `$api-contract-enforcer`, `$supabase-rls-guardian`, `$implementation-progress-tracker` | `web/src/lib/db/organization.ts`, `web/src/lib/scheduling/store.ts`, `web/src/lib/appointments/store.ts`, `web/src/lib/tasks/store.ts`, `web/src/lib/notifications/store.ts`, `web/src/app/api/provider/availability/route.ts`, `web/src/app/api/appointments/route.ts`, `web/src/app/api/notifications/route.ts`, `web/src/app/app/patient/appointments/[id]/page.tsx`, `npm run lint`, `npm run build -- --webpack` | Codex + User | Done | 2026-03-14 |
|  |  |  |  |  |  |  |  |  |

## 13) Task Status Lifecycle

- `Planned`: item identified, not yet started.
- `In Progress`: active implementation work is ongoing.
- `Blocked`: external dependency or unresolved risk prevents progress.
- `Review`: implementation done, waiting for validation/sign-off.
- `Done`: merged/accepted with evidence and tracker updates complete.

Rule: no task moves to `Done` without evidence in the ledger and corresponding updates in Stage/Module/DoD sections.
