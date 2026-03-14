# Next.js + Supabase Master Build Plan
## Project: API-First Virtual Health Platform

## 1. Purpose of This Document
This document is the implementation-ready source of truth for building the application end to end in Next.js with Supabase. It is written so it can be handed back into Codex for development without needing to reinterpret the product from scratch.

Use this document for:
- Feature-by-feature implementation planning
- Route and module breakdown
- Backend and database responsibilities
- UI and UX expectations
- Environment and integration setup
- Sprint sequencing and delivery checkpoints

When building UI, use the local skill `$virtual-health-ui` from [skills/virtual-health-ui/SKILL.md](/Users/apple/Desktop/ai_project/skills/virtual-health-ui/SKILL.md).

## 2. Product Goal
Build a multi-tenant virtual care platform for digital health organizations that supports patient onboarding, appointment booking, telehealth visits, longitudinal health records, provider workflows, messaging, care plans, billing foundations, integrations, analytics, and admin operations.

The product should feel:
- Fast for providers during active clinic hours
- Calm and trustworthy for patients
- Safe for PHI and role-scoped access
- Extensible for future API consumers and white-label organizations

## 3. Product Boundaries
### In MVP
- Multi-tenant architecture with strict organization isolation, white-label readiness, and tenant-safe data boundaries
- Patient onboarding and intake
- Scheduling and reminders
- Telehealth visit workflow and visit-state management without mandatory third-party video integration in MVP
- Longitudinal patient chart
- Clinical notes and templates
- Patient portal
- Provider dashboard
- Secure messaging
- Care plans and tasks
- Billing/payment foundations with dummy or manual payment flow in MVP
- Admin console basics
- Audit logging, RLS, observability, and compliance foundations
- Specialty-configurable forms, templates, labels, and workflows so the app can adapt over time without hardcoding one specialty

### Phase 2+ but planned now
- E-prescribing
- Lab orders and results
- Claims submission workflow
- FHIR interoperability
- API management console
- Chronic care management and remote monitoring
- Native mobile apps
- Advanced analytics and quality measures
- Daily or Twilio video integration
- Stripe production integration

## 4. Target Users and Access Model
### Patient
Can register, complete intake, manage appointments, attend visits, review records that are meant for patient visibility, exchange messages, pay invoices, and manage profile details.

### Provider
Can manage schedule, conduct visits, chart, review patient records, manage prescriptions, assign tasks, communicate with patients, and coordinate care.

### Admin
Can manage organization settings, staff, templates, workflows, billing operations, analytics, audits, integrations, and support workflows.

### Super Admin
Can manage platform-wide organizations, feature flags, operational dashboards, and high-trust support actions.

### System Rules
- MVP must support multiple healthcare organizations with isolated data, configuration, templates, staff, and reporting boundaries.
- Every request must resolve actor role, organization, and assignment context.
- Every PHI read/write path must be protected by RLS plus app-level authorization.
- Every privileged action must produce an audit log.
- Specialty-specific behavior should come from configuration, templates, and workflow rules rather than hardcoded specialty branches.
- White-label behavior should be configuration-driven through organization branding, copy, and settings rather than forked code paths.

## 5. Technical Stack
### Frontend
- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form + Zod
- TanStack Query only where client-side data sync is needed
- PWA shell for installability and offline-tolerant viewing flows

### Backend
- Next.js Route Handlers for app APIs
- Server Actions for trusted form workflows when appropriate
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Supabase Realtime
- Supabase Edge Functions for webhook processing and partner integrations

### Supporting Services
- Sentry for error monitoring
- PostHog for product analytics
- Vercel for deployment
- Daily or Twilio for video in a future phase
- Stripe for payments in a future phase
- Resend, SendGrid, or Mailtrap for email
- Twilio for SMS
- Optional later: Surescripts, Change Healthcare, lab partner, FHIR exchange partner

## 6. Required Application Standards
- App must be fully typed.
- Every request and mutation must validate input with Zod.
- Every API response must use a consistent response envelope.
- No direct database access from client components.
- Every domain module must have explicit ownership boundaries.
- Every new table must ship with migration, indexes, RLS, and policy tests.
- Every critical user flow must have audit events and Sentry breadcrumbs.
- Every UI screen must support empty, loading, error, and success states.
- Accessibility is required, not optional.
- Define and track SLIs/SLOs for availability, latency, and error rate before pilot launch.
- Every production deployment must pass CI quality gates: typecheck, lint, tests, migration checks, and security scans.
- Every sensitive integration and mutation path must be idempotent and include retry-safe behavior.
- Backup restore drills and disaster recovery verification are mandatory before general availability.

## 7. Information Architecture and Route Map
### Public Routes
- `/`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/invite/accept`
- `/legal/privacy`
- `/legal/terms`

### Patient App
- `/app/patient/dashboard`
- `/app/patient/onboarding`
- `/app/patient/appointments`
- `/app/patient/appointments/[id]`
- `/app/patient/messages`
- `/app/patient/records`
- `/app/patient/care-plans`
- `/app/patient/billing`
- `/app/patient/settings`

### Provider App
- `/app/provider/dashboard`
- `/app/provider/schedule`
- `/app/provider/patients`
- `/app/provider/patients/[id]`
- `/app/provider/encounters/[id]`
- `/app/provider/notes/[id]`
- `/app/provider/messages`
- `/app/provider/tasks`
- `/app/provider/templates`
- `/app/provider/settings`

### Admin App
- `/app/admin/dashboard`
- `/app/admin/organization`
- `/app/admin/providers`
- `/app/admin/patients`
- `/app/admin/workflows`
- `/app/admin/billing`
- `/app/admin/claims`
- `/app/admin/analytics`
- `/app/admin/audit`
- `/app/admin/integrations`
- `/app/admin/settings`

### Platform/Developer Routes
- `/developers`
- `/developers/docs`
- `/developers/keys`
- `/developers/webhooks`

## 8. Core App Modules
### 8.1 Authentication, Organization Setup, and Access Control
#### Goal
Create secure sign-in, invitation, session, and role resolution flows that support a multi-tenant healthcare product from day one.

#### User Experience
- Email/password authentication first
- Optional magic link for patient convenience later
- Invite-based staff onboarding
- Forced MFA for provider/admin/super-admin roles
- Session timeout and re-auth for high-risk actions

#### Backend Responsibilities
- Supabase Auth integration
- Profile bootstrap after signup
- Organization membership resolution
- Role and permission enforcement
- Auth event logging

#### Database Responsibilities
- `organizations`
- `users`
- `organization_memberships`
- `roles`
- `permissions`
- `user_mfa_enrollments`
- `audit_logs`

#### Rules
- MVP supports multiple organizations with strict row-level isolation.
- Users should default to one organization membership in MVP unless a clear cross-org need exists, but the data model must support controlled expansion later.
- Patients cannot access provider/admin routes.
- Providers can only access patients assigned to them or made visible by care team rules.

### 8.2 Patient Registration and Onboarding
#### Goal
Enable a patient to create an account, complete required intake, submit identity and insurance information, accept consents, and become ready for scheduling and care.

#### UI Surfaces
- Patient onboarding wizard
- Intake form sections
- Consent review and signature screens
- Insurance and identity upload screens

#### Data Captured
- Demographics
- Contact details
- Emergency contact
- Medical history
- Allergies
- Current medications
- Baseline vitals if needed
- Insurance plan information
- Identity verification evidence if required
- Consent versions and acceptance timestamps

#### Backend Responsibilities
- Persist draft onboarding states
- Validate required fields by organization policy
- Handle file uploads for insurance cards and documents
- Record consent version accepted by patient
- Trigger readiness status for booking eligibility

#### MVP Behavior
- Multi-step save-and-resume flow
- Patient sees progress indicator
- Required validations are clear and non-clinical language is used
- Incomplete onboarding blocks appointment booking when configured
- Intake sections and terminology should be driven by configurable templates so the launch specialty can change without a major rebuild

### 8.3 Appointment Scheduling
#### Goal
Make booking extremely simple for patients while giving providers accurate availability and admins clear control over scheduling rules.

#### UI Surfaces
- Patient booking flow
- Provider availability manager
- Admin schedule configuration
- Appointment detail page

#### Functional Requirements
- Provider availability and time blocks
- Appointment types and durations
- Booking, rescheduling, cancellation
- Confirmation and reminder notifications
- Time zone handling
- Calendar sync readiness

#### Backend Responsibilities
- Slot generation and collision prevention
- Appointment status transitions
- Reminder job scheduling
- ICS/calendar payload generation later

#### Rules
- Booking flow should be 3 steps or fewer for returning patients.
- Reschedule and cancellation policies must be organization-configurable.
- Reminder delivery preferences come from patient communication settings.

### 8.4 Telehealth Visit Flow
#### Goal
Support safe, stable remote visits with clear pre-visit, in-visit, and post-visit experiences.

#### UI Surfaces
- Visit waiting room
- Device/mic/camera pre-check
- Provider visit room
- Visit summary handoff state

#### Functional Requirements
- Generate internal visit session state and future-ready token integration hooks
- Launch a provider/patient visit experience that can start with a simple consultation room or placeholder join flow in MVP
- Show participant status
- Capture visit start/end state
- Allow provider note-taking during visit
- Support recording/screen-sharing only in a later integration phase where policy allows

#### Rules
- Patient cannot enter the room before allowed threshold unless configured.
- Provider sees quick actions for notes, patient chart, tasks, and follow-up.
- Visit failures must be visible in support telemetry.
- Video vendor integration must remain behind a feature flag and adapter interface so Daily or Twilio can be added later without rewriting clinical workflows.

### 8.5 Longitudinal Patient Chart
#### Goal
Give providers a complete, fast patient record that is easy to scan and safe to update.

#### UI Surfaces
- Patient summary
- Timeline
- Problems/diagnoses
- Medications
- Allergies
- Procedures
- Vitals
- Documents
- Care plans

#### Data Domains
- `patients`
- `medical_records`
- `encounters`
- `medications`
- `allergies`
- `vital_signs`
- `diagnoses`
- `procedures`
- `documents`
- `care_plans`

#### UX Expectations
- Timeline should prioritize recent clinically relevant data.
- Providers should reach note creation in one click from the chart.
- High-risk data such as allergies should always remain visually obvious.

### 8.6 Clinical Documentation
#### Goal
Make charting fast, structured, and provider-friendly.

#### UI Surfaces
- New note form
- Encounter-linked documentation screen
- Template picker
- Draft recovery and autosave indicators

#### Functional Requirements
- SOAP notes
- Progress notes
- Template library
- Autosave drafts
- Finalize and sign workflow
- Amendment/audit trail support
- Voice-to-text readiness

#### Rules
- Signed notes become immutable except through amendment flow.
- Autosave must not create duplicate drafts.
- Templates may be organization-scoped and role-scoped.

### 8.7 Prescription Management
#### Goal
Prepare the platform for safe medication workflows and phased e-prescribing rollout.

#### MVP Foundation
- Medication list management
- Pharmacy preference capture
- Prescription draft model
- Refill request UI placeholders
- Drug interaction and allergy check integration points

#### Later Integration
- Surescripts or equivalent eRx network
- Controlled-substance handling only after legal/compliance review

#### Rules
- Prescription actions require provider role and elevated audit coverage.
- Medication reconciliation must surface source and last-updated details.

### 8.8 Messaging, Notifications, and Communication Hub
#### Goal
Support secure, role-aware communication without mixing medical conversations into unsafe channels.

#### Channels
- In-app secure messaging
- Email notifications
- SMS reminders

#### Functional Requirements
- Patient-provider threads
- Attachment support with PHI controls
- Notification preferences
- Read/unread state
- Follow-up nudges
- Delivery status visibility

#### Rules
- Email and SMS should never contain sensitive clinical details.
- Message visibility must follow assignment and organization scope.
- Communication preferences must respect consent state.

### 8.9 Care Plans, Tasks, and Workflow Automation
#### Goal
Support continuity of care after visits through structured plans, tasks, handoffs, and automated follow-up.

#### Functional Requirements
- Care plan authoring
- Task assignment with owner and due date
- Referral tracking
- Protocol-driven workflows
- Automated follow-up reminders
- Handoff notes between team members

#### Rules
- Every task needs owner, state, and due date.
- Automated workflows must be idempotent.
- Escalations and overdue items need admin/provider visibility.

### 8.10 Billing, Payments, and Claims Foundation
#### Goal
Lay down revenue foundations without blocking clinical workflows.

#### MVP
- Invoice creation
- Dummy or manual payment collection flow for demos and operational testing
- Insurance plan storage
- Eligibility verification placeholders
- Billing dashboard

#### Next Phase
- Stripe production integration
- Claims creation
- Claim event timeline
- Denial tracking
- Billing code support
- Reconciliation jobs

#### Rules
- Financial records must be immutable by event, not overwritten in place.
- Payment webhooks must be signed and idempotent.

### 8.11 Labs, Interoperability, and External Integrations
#### Goal
Prepare the platform to exchange data with labs, payers, and external health systems.

#### Functional Requirements
- Lab order model
- Lab result ingestion model
- FHIR mapping layer
- Webhook ingestion framework
- Integration status center for admins

#### Rules
- External payloads must be stored in raw and normalized form where needed.
- All integration events must be traceable and replayable.
- Internal canonical models remain the source of truth for UI.

### 8.12 Analytics, Reporting, and Quality Measures
#### Goal
Give leadership, operations, and care teams meaningful visibility into usage, performance, and outcomes.

#### Dashboards
- Operational dashboard
- Provider productivity
- Patient engagement
- Appointment funnel and no-show rate
- Revenue and billing health
- Security/compliance visibility

#### Next-Phase Analytics
- Quality measures
- Clinical outcomes
- Population health
- API usage analytics
- Time-to-onboard for new organizations

#### Rules
- Analytics sinks must not leak PHI.
- KPI definitions must be owned and documented.

### 8.13 Admin Console and Platform Operations
#### Goal
Give admins control over configuration without requiring direct database work.

#### Functional Requirements
- Organization settings
- Provider management
- Template management
- Workflow configuration
- Billing settings
- Audit review
- Feature flag visibility
- Integration configuration status

#### Rules
- Dangerous settings require confirmation and audit log.
- Admin actions remain organization-scoped unless super-admin override exists.

### 8.14 API Platform and Developer Experience
#### Goal
Support future partners and customers who want API-first access.

#### Functional Requirements
- API docs route
- Service account or API key strategy
- Webhook management
- Usage analytics
- Rate limits
- Versioning conventions

#### Rules
- Public API surfaces must have stricter review gates.
- Every new public endpoint must include example payloads and failure modes.

### 8.15 Mobile and Offline Strategy
#### Goal
Support high-usage mobile access without overcommitting early to native complexity.

#### Approach
- MVP uses responsive web plus PWA shell
- Focus on patient portal, schedule, messages, visit join, and provider quick review flows
- Track actual usage before committing to React Native

#### Offline Expectations
- Cache non-sensitive shell assets
- Graceful network loss messaging
- Limited draft persistence where safe
- No unsafe offline writes for sensitive clinical operations without explicit sync design

### 8.16 Multi-Tenant and White-Label Platform Controls
#### Goal
Support multiple healthcare organizations in the same platform while preserving data isolation, role boundaries, and future white-label flexibility.

#### Functional Requirements
- Organization-aware auth resolution on every request
- Organization-scoped configuration, templates, branding, workflows, and analytics
- Tenant-aware route guards and admin boundaries
- Separate storage paths and signed URL controls per organization
- Organization-specific feature flags and release controls

#### Rules
- No cross-tenant data visibility through UI, API, analytics, logs, or storage paths.
- Tenant context must be explicit in app services and implicit in database RLS.
- White-label needs must be met through configuration and theming, not duplicate applications.

### 8.17 Chronic Care, Population Health, and Device Readiness
#### Goal
Prepare the platform for longitudinal programs that extend beyond single appointments.

#### MVP Foundation
- Care-plan adherence tracking
- Longitudinal follow-up tasks
- Population cohort definitions
- Data model placeholders for device readings and monitoring programs

#### Next Phase
- Remote patient monitoring
- Population health dashboards
- Device/wearable integrations
- Chronic care billing and workflow automation

#### Rules
- Monitoring programs must remain consent-aware and specialty-configurable.
- Device and RPM ingestion must pass through normalized validation pipelines.

## 9. Blueprint Coverage Matrix
This section exists so implementation can be checked line by line against the product blueprint instead of relying on memory.

### Core and Important Features
1. Patient Registration & Onboarding: Covered in `8.2`. MVP includes customizable intake, save-and-resume onboarding, consent capture, insurance capture, identity-validation readiness, and specialty-configurable onboarding templates.
2. Appointment Scheduling: Covered in `8.3`. MVP includes provider availability, appointment types, booking/rescheduling/cancellation, automated reminders, and calendar-integration-ready design.
3. Video Consultation Engine: Covered in `8.4`. MVP includes visit-state management, waiting room, join flow, in-visit documentation, and provider quick actions. HIPAA video, recording, and screen sharing are implemented through a future vendor adapter so workflow is ready even if third-party video is deferred.
4. Electronic Health Records: Covered in `8.5`. MVP includes chart timeline, medical history, medications, allergies, diagnoses, procedures, documents, vitals, and care plans.
5. Provider Dashboard: Covered in `8.5`, `8.6`, and patient/provider routes in `7`. MVP includes daily queue, patient snapshots, note access, templates, and treatment-planning entry points.
6. Patient Portal: Covered in `7` and `8.2`, `8.3`, `8.8`, `8.10`. MVP includes self-service appointments, records access, communication, billing visibility, and profile management.
7. Prescription Management: Covered in `8.7`. MVP includes medication list, pharmacy preference, prescription draft model, refill placeholders, and interaction-check integration points. Full e-prescribing network integration is phase 2.
8. Billing & Claims Processing: Covered in `8.10`. MVP includes invoices, manual/dummy payment handling, insurance storage, and billing dashboard. Claims submission and production payment integration are phase 2 but architected now.
9. HIPAA Compliance Suite: Covered across `4`, `6`, `8.1`, `8.8`, `8.13`, and `12`. MVP includes RLS, audit logs, privileged-access controls, MFA for staff, consent tracking, and compliance-ready operational patterns.
10. Clinical Documentation: Covered in `8.6`. MVP includes SOAP/progress notes, templates, autosave, sign/finalize flow, amendment path, and voice-to-text readiness.
11. Care Team Coordination: Covered in `8.8` and `8.9`. MVP includes shared care plans, task ownership, handoff notes, and role-aware communication.
12. Lab & Diagnostic Integration: Covered in `8.11`. MVP includes canonical models, order/result architecture, and integration scaffolding. Live partner integrations are phase 2.
13. Patient Communication Hub: Covered in `8.8`. MVP includes secure messaging, notifications, outreach patterns, preferences, and safe email/SMS boundaries.
14. Mobile Applications: Covered in `8.15` and the route strategy in `7`. MVP includes responsive web plus PWA foundation and offline-tolerant UX. Native iOS/Android apps are phase 2, but component and API design must remain mobile-ready.
15. Reporting & Analytics: Covered in `8.12`. MVP includes operational dashboards, patient engagement, productivity, funnel, security, and revenue-health reporting with room for clinical/regulatory analytics later.
16. Multi-Tenant Architecture: Covered in `2`, `3`, `4`, `8.1`, `8.16`, `12`, and `15`. This is in MVP and is not deferred.
17. Insurance Verification: Covered in `8.2` and `8.10`. MVP includes eligibility-ready data model and workflow placement. Real-time payer verification may move to phase 2 if vendor integration is deferred.
18. Consent Management: Covered in `8.2`, `8.8`, and `11`. MVP includes consent capture, version tracking, acceptance timestamps, and workflow-aware enforcement.
19. Workflow Automation: Covered in `8.9`. MVP includes protocol-driven care pathways, task assignment, follow-up automation, and escalation foundations.
20. API Management Console: Covered in `7`, `8.14`, and `12`. MVP planning includes developer routes, API docs, authentication model, rate limits, and usage analytics. Full external-console polish can land after core product MVP if needed.
21. Chronic Care Management: Covered in `8.9` and `8.17`. MVP includes care-plan adherence and longitudinal follow-up foundations. RPM and chronic-care programs expand in phase 2.
22. Quality Measures Tracking: Covered in `8.12` and `8.17`. MVP planning includes compliant analytics structure and reporting foundations. Full HEDIS/CMS automation is phase 2.

### Advanced and Differentiating Features
1. AI-Powered Clinical Decision Support: Planned after core data quality and charting reliability are proven. Requires governance, model safety, and clinician override design.
2. Predictive Health Analytics: Planned after quality analytics and cohort pipelines exist. Depends on reliable longitudinal data and outcomes baselines.
3. Voice-Enabled Clinical Assistant: Planned after documentation workflows stabilize. MVP keeps voice-to-text readiness so this can layer in later.
4. Blockchain Health Records: Explicitly future-facing and not needed for MVP. The current plan prefers auditable relational records over blockchain complexity.
5. IoT Device Integration Platform: Covered by `8.17` as data-model and ingestion readiness first, live integrations later.
6. Advanced Telehealth Modalities: Future phase only. Keep telehealth module adapter-based so multi-party or richer visit modes can be added later.
7. Real-Time Language Translation: Covered as a future enhancement to communication and visit flows, building on `8.8`.
8. Automated Prior Authorization: Planned after billing, claims, and payer integrations exist.
9. Digital Therapeutics Platform: Future innovation track after care plans and workflow engines are mature.
10. Social Determinants of Health Tracking: Should be modeled as configurable intake/care-plan extensions after core onboarding stabilizes.
11. Genomics Integration Suite: Future integration track after interoperability foundations land.
12. Mental Health AI Companion: Future innovation track and not part of MVP due to safety/compliance implications.
13. Interoperability Hub: Covered by `8.11` as FHIR-ready architecture now and broader exchange capabilities in later phases.

## 10. Skill Usage During Implementation
To reduce drift between planning and delivery, implementation should explicitly use local skills where relevant.

### Required Skill Usage
- Use `$virtual-health-ui` for any page, layout, component, dashboard, form flow, or screen-state work.
- Use the screen inventory reference at [screen-inventory.md](/Users/apple/Desktop/ai_project/skills/virtual-health-ui/references/screen-inventory.md) when mapping modules to concrete pages.
- If UI requirements conflict with generic component-library defaults, follow `$virtual-health-ui`.

### Practical Rule
- Product behavior comes from this master plan.
- UI execution comes from `$virtual-health-ui`.
- Database, API, and security decisions must still follow this master plan even when a UI request sounds narrower.

## 11. Implementation Guardrails So Nothing Is Missed
- No feature starts without mapping it back to at least one numbered module in section `8` and one blueprint item in section `9`.
- No screen ships without confirming patient/provider/admin role behavior where applicable.
- No integration-heavy feature is marked done with only UI mocks; backend contracts and persistence rules must exist too.
- No future-phase item should block MVP unless it is a foundational dependency.
- Deferred third-party integrations must still have adapter interfaces, config placeholders, and domain models in place if they affect future architecture.
- Multi-tenant boundaries must be validated in tests for every sensitive table and route.

## 12. Supabase Responsibilities by Capability
### Auth
- User authentication
- Session management
- Password reset
- MFA for privileged roles

### Database
- Multi-tenant Postgres schema
- RLS enforcement
- Migrations
- Functions/RPC where helpful

### Storage
- Insurance cards
- Consent PDFs
- Clinical documents
- Attachments

### Realtime
- Messaging updates
- Notification counters
- Presence-style updates only where genuinely useful

### Edge Functions
- Webhook receivers
- Stripe synchronization in a future phase
- Video token generation helpers in a future phase
- Integration adapters for labs, eRx, or interoperability

## 13. Recommended App Folder Structure
```text
src/
  app/
    (public)/
    app/
      patient/
      provider/
      admin/
      developers/
    api/
  components/
    ui/
    layout/
    forms/
    domain/
  features/
    auth/
    onboarding/
    scheduling/
    telehealth/
    chart/
    notes/
    prescriptions/
    messaging/
    care-plans/
    billing/
    analytics/
    admin/
  lib/
    auth/
    db/
    env/
    validation/
    permissions/
    audit/
    telemetry/
  server/
    services/
    repositories/
    jobs/
  types/
  styles/
supabase/
  migrations/
  seeds/
  tests/
docs/
skills/
```

## 14. Detailed Database Architecture Plan
This section is the implementation database blueprint. It defines how the Supabase Postgres layer should be structured so the app remains secure, multi-tenant, query-efficient, and extensible.

### 14.1 Database Design Principles
- Use `uuid` primary keys for all business tables.
- Keep `organization_id` on every tenant-owned table unless the table is truly global.
- Prefer normalized transactional tables for source-of-truth data and derived/materialized structures for analytics.
- Use `created_at`, `updated_at`, `created_by`, and `updated_by` consistently on mutable domain tables.
- Use soft delete only where business recovery is valuable; otherwise prefer immutable status transitions and audit events.
- Store external payloads separately from canonical records so partner-specific formats do not pollute internal models.
- Model status as explicit enums or constrained text values, not free-form strings.
- Never depend only on app logic for isolation; enforce access with RLS.

### 14.2 Recommended Schemas
- `public`: core product data and app-facing transactional tables
- `audit`: append-only audit and security event tables
- `integration`: external payloads, sync logs, webhooks, and partner mapping tables
- `analytics`: derived events, snapshots, KPI aggregates, and materialized views

### 14.3 Common Column Conventions
Most tenant-scoped tables should include:
- `id uuid primary key default gen_random_uuid()`
- `organization_id uuid not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `created_by uuid null`
- `updated_by uuid null`

Common metadata fields where needed:
- `status`
- `metadata jsonb default '{}'::jsonb`
- `source_system text`
- `external_id text`

### 14.4 Identity and Access Tables
#### organizations
Purpose: tenant root record for each healthcare organization.

Key columns:
- `id`
- `name`
- `slug`
- `status`
- `branding_settings jsonb`
- `timezone`
- `default_specialty_config jsonb`
- `feature_flags jsonb`

Indexes:
- unique index on `slug`
- index on `status`

#### users
Purpose: app-level profile record linked to Supabase Auth user.

Key columns:
- `id` same as `auth.users.id`
- `email`
- `full_name`
- `phone`
- `global_status`
- `last_seen_at`

Indexes:
- unique index on `email`
- index on `global_status`

#### organization_memberships
Purpose: assigns a user to an organization with a role boundary.

Key columns:
- `id`
- `organization_id`
- `user_id`
- `role_id`
- `membership_status`
- `is_default_org boolean`

Constraints and indexes:
- unique index on `(organization_id, user_id)`
- index on `(user_id, membership_status)`
- index on `(organization_id, role_id)`

#### roles
Purpose: role definition per tenant or global default.

Key columns:
- `id`
- `organization_id nullable`
- `code`
- `name`
- `is_system_role`

Constraints:
- unique index on `(coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), code)`

#### permissions
Purpose: normalized permission catalog.

Key columns:
- `id`
- `resource`
- `action`
- `scope`

Constraint:
- unique index on `(resource, action, scope)`

#### role_permissions
Purpose: many-to-many bridge between roles and permissions.

Key columns:
- `role_id`
- `permission_id`

Constraint:
- unique index on `(role_id, permission_id)`

### 14.5 Clinical and Patient Master Tables
#### patients
Purpose: primary patient identity record inside an organization.

Key columns:
- `id`
- `organization_id`
- `user_id nullable`
- `medical_record_number`
- `first_name`
- `last_name`
- `dob`
- `sex_at_birth`
- `gender_identity`
- `phone`
- `email`
- `onboarding_status`
- `portal_status`

Indexes:
- unique index on `(organization_id, medical_record_number)`
- index on `(organization_id, last_name, first_name)`
- index on `(organization_id, onboarding_status)`
- optional trigram index for patient search on full name/email

#### patient_contacts
Purpose: emergency contacts, caregivers, and relationship contacts.

Key columns:
- `patient_id`
- `contact_type`
- `name`
- `relationship`
- `phone`
- `email`

Indexes:
- index on `(patient_id, contact_type)`

#### providers
Purpose: clinical provider profile inside an organization.

Key columns:
- `id`
- `organization_id`
- `user_id`
- `npi`
- `specialty`
- `license_number`
- `provider_status`
- `calendar_settings jsonb`

Indexes:
- unique index on `(organization_id, user_id)`
- index on `(organization_id, provider_status)`
- index on `(organization_id, specialty)`

#### patient_provider_assignments
Purpose: maps care-team and assignment visibility.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `provider_id`
- `assignment_type`
- `is_primary`
- `starts_at`
- `ends_at`

Indexes:
- index on `(organization_id, patient_id)`
- index on `(organization_id, provider_id)`
- partial index for active assignments where `ends_at is null or ends_at > now()`

### 14.6 Onboarding, Consent, and Insurance Tables
#### intake_forms
Purpose: tenant-configurable intake form definitions.

Key columns:
- `id`
- `organization_id`
- `name`
- `version`
- `specialty_scope`
- `schema jsonb`
- `is_active`

Constraints:
- unique index on `(organization_id, name, version)`

#### intake_submissions
Purpose: patient-submitted onboarding and intake responses.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `intake_form_id`
- `status`
- `submitted_at`
- `answers jsonb`

Indexes:
- index on `(organization_id, patient_id, status)`
- index on `(organization_id, intake_form_id)`

#### consent_definitions
Purpose: versioned consent templates.

Key columns:
- `id`
- `organization_id`
- `consent_type`
- `version`
- `title`
- `content_ref`
- `is_active`

Constraints:
- unique index on `(organization_id, consent_type, version)`

#### consents
Purpose: actual patient consent acceptance records.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `consent_definition_id`
- `accepted_at`
- `accepted_by_user_id`
- `ip_address`
- `signature_ref`
- `status`

Indexes:
- index on `(organization_id, patient_id, accepted_at desc)`
- index on `(organization_id, consent_definition_id)`

#### insurance_plans
Purpose: patient insurance coverage and payer details.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `payer_name`
- `member_id`
- `group_number`
- `plan_type`
- `subscriber_name`
- `relationship_to_subscriber`
- `coverage_status`
- `verification_status`

Indexes:
- index on `(organization_id, patient_id)`
- index on `(organization_id, verification_status)`

#### insurance_verification_events
Purpose: track manual or automated eligibility checks.

Key columns:
- `id`
- `organization_id`
- `insurance_plan_id`
- `verification_source`
- `requested_at`
- `completed_at`
- `status`
- `response_summary jsonb`
- `raw_response_ref`

Indexes:
- index on `(organization_id, insurance_plan_id, requested_at desc)`
- index on `(organization_id, status)`

### 14.7 Scheduling and Visit Tables
#### appointment_types
Purpose: tenant-configurable visit types and scheduling rules.

Key columns:
- `id`
- `organization_id`
- `name`
- `duration_minutes`
- `buffer_before_minutes`
- `buffer_after_minutes`
- `location_type`
- `requires_intake_completion`

#### availability_rules
Purpose: provider availability templates.

Key columns:
- `id`
- `organization_id`
- `provider_id`
- `weekday`
- `start_time`
- `end_time`
- `location_type`
- `is_active`

Indexes:
- index on `(organization_id, provider_id, weekday)`

#### provider_time_off
Purpose: blocks provider schedule.

Key columns:
- `id`
- `organization_id`
- `provider_id`
- `starts_at`
- `ends_at`
- `reason`

Indexes:
- index on `(organization_id, provider_id, starts_at)`

#### appointments
Purpose: core booking record.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `provider_id`
- `appointment_type_id`
- `status`
- `scheduled_start`
- `scheduled_end`
- `visit_mode`
- `booking_source`
- `cancellation_reason`

Indexes:
- index on `(organization_id, provider_id, scheduled_start)`
- index on `(organization_id, patient_id, scheduled_start desc)`
- index on `(organization_id, status, scheduled_start)`

#### appointment_reminders
Purpose: notification schedule and delivery status for reminders.

Key columns:
- `id`
- `organization_id`
- `appointment_id`
- `channel`
- `scheduled_for`
- `sent_at`
- `delivery_status`

Indexes:
- index on `(organization_id, scheduled_for, delivery_status)`

#### encounters
Purpose: actual clinical encounter lifecycle linked to appointment or walk-in workflow.

Key columns:
- `id`
- `organization_id`
- `appointment_id nullable`
- `patient_id`
- `provider_id`
- `status`
- `started_at`
- `ended_at`
- `encounter_type`

Indexes:
- index on `(organization_id, patient_id, started_at desc)`
- index on `(organization_id, provider_id, started_at desc)`

#### visit_sessions
Purpose: video/join-state and room-level visit orchestration.

Key columns:
- `id`
- `organization_id`
- `encounter_id`
- `vendor`
- `vendor_session_id`
- `session_status`
- `join_token_ref`
- `recording_status`

Indexes:
- index on `(organization_id, encounter_id)`
- index on `(organization_id, session_status)`

### 14.8 Longitudinal Chart and Clinical Documentation Tables
#### medical_records
Purpose: optional chart summary / chart header record per patient.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `summary jsonb`
- `risk_flags jsonb`

Constraint:
- unique index on `(organization_id, patient_id)`

#### allergies
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `substance`
- `reaction`
- `severity`
- `status`

Indexes:
- index on `(organization_id, patient_id, status)`
- index on `(organization_id, substance)`

#### medications
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `name`
- `dose`
- `route`
- `frequency`
- `start_date`
- `end_date`
- `status`
- `source_type`

Indexes:
- index on `(organization_id, patient_id, status)`
- index on `(organization_id, name)`

#### vital_signs
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `encounter_id nullable`
- `recorded_at`
- `vital_type`
- `value_numeric`
- `value_text`
- `unit`

Indexes:
- index on `(organization_id, patient_id, recorded_at desc)`
- index on `(organization_id, encounter_id)`

#### diagnoses
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `encounter_id nullable`
- `code`
- `coding_system`
- `description`
- `clinical_status`

Indexes:
- index on `(organization_id, patient_id)`
- index on `(organization_id, code)`

#### procedures
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `encounter_id nullable`
- `code`
- `coding_system`
- `description`
- `performed_at`

Indexes:
- index on `(organization_id, patient_id, performed_at desc)`
- index on `(organization_id, code)`

#### clinical_notes
Purpose: structured documentation record.

Key columns:
- `id`
- `organization_id`
- `patient_id`
- `encounter_id`
- `author_provider_id`
- `template_id nullable`
- `note_type`
- `status`
- `subjective jsonb`
- `objective jsonb`
- `assessment jsonb`
- `plan jsonb`
- `signed_at`
- `amends_note_id nullable`

Indexes:
- index on `(organization_id, patient_id, created_at desc)`
- index on `(organization_id, encounter_id)`
- index on `(organization_id, author_provider_id, status)`

#### note_templates
Purpose: reusable templates for notes and documentation.

Key columns:
- `id`
- `organization_id`
- `name`
- `template_type`
- `specialty_scope`
- `body jsonb`
- `is_active`

Indexes:
- index on `(organization_id, template_type, is_active)`

### 14.9 Care Coordination and Communication Tables
#### care_plans
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `owner_provider_id`
- `title`
- `status`
- `start_date`
- `target_date`

Indexes:
- index on `(organization_id, patient_id, status)`
- index on `(organization_id, owner_provider_id, status)`

#### care_tasks
Key columns:
- `id`
- `organization_id`
- `care_plan_id nullable`
- `patient_id`
- `assigned_to_user_id`
- `task_type`
- `title`
- `status`
- `priority`
- `due_at`

Indexes:
- index on `(organization_id, assigned_to_user_id, status, due_at)`
- index on `(organization_id, patient_id, status)`

#### referrals
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `requested_by_provider_id`
- `target_specialty`
- `status`
- `reason`

Indexes:
- index on `(organization_id, patient_id, status)`

#### message_threads
Key columns:
- `id`
- `organization_id`
- `patient_id nullable`
- `subject`
- `thread_type`
- `status`
- `last_message_at`

Indexes:
- index on `(organization_id, patient_id, last_message_at desc)`
- index on `(organization_id, status, last_message_at desc)`

#### thread_participants
Purpose: participant visibility and unread tracking boundary.

Key columns:
- `id`
- `organization_id`
- `thread_id`
- `user_id`
- `participant_role`
- `last_read_at`

Constraints:
- unique index on `(thread_id, user_id)`

#### messages
Key columns:
- `id`
- `organization_id`
- `thread_id`
- `sender_user_id`
- `body`
- `message_type`
- `sent_at`

Indexes:
- index on `(organization_id, thread_id, sent_at)`

#### notifications
Key columns:
- `id`
- `organization_id`
- `user_id`
- `channel`
- `notification_type`
- `title`
- `body`
- `status`
- `scheduled_for`
- `sent_at`

Indexes:
- index on `(organization_id, user_id, status, scheduled_for)`
- index on `(organization_id, channel, status, scheduled_for)`

### 14.10 Revenue, Billing, and Claims Tables
#### invoices
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `appointment_id nullable`
- `invoice_number`
- `status`
- `subtotal_amount`
- `tax_amount`
- `total_amount`
- `currency`
- `issued_at`
- `due_at`

Indexes:
- unique index on `(organization_id, invoice_number)`
- index on `(organization_id, patient_id, issued_at desc)`
- index on `(organization_id, status, due_at)`

#### invoice_line_items
Key columns:
- `id`
- `invoice_id`
- `billing_code_id nullable`
- `description`
- `quantity`
- `unit_amount`
- `line_total`

Indexes:
- index on `(invoice_id)`

#### payments
Key columns:
- `id`
- `organization_id`
- `invoice_id nullable`
- `patient_id`
- `payment_method`
- `amount`
- `status`
- `paid_at`
- `external_payment_id`

Indexes:
- index on `(organization_id, patient_id, paid_at desc)`
- index on `(organization_id, status, paid_at desc)`

#### claims
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `insurance_plan_id`
- `encounter_id nullable`
- `claim_number`
- `status`
- `submitted_at`
- `payer_name`

Indexes:
- index on `(organization_id, patient_id, submitted_at desc)`
- index on `(organization_id, status, submitted_at desc)`

#### claim_events
Key columns:
- `id`
- `organization_id`
- `claim_id`
- `event_type`
- `event_at`
- `details jsonb`

Indexes:
- index on `(organization_id, claim_id, event_at desc)`

#### billing_codes
Key columns:
- `id`
- `organization_id nullable`
- `code_type`
- `code`
- `description`
- `is_active`

Indexes:
- index on `(code_type, code)`
- index on `(organization_id, is_active)`

### 14.11 Documents, Labs, Integrations, and Future-Readiness Tables
#### documents
Purpose: metadata for uploaded files in Supabase Storage.

Key columns:
- `id`
- `organization_id`
- `patient_id nullable`
- `encounter_id nullable`
- `document_type`
- `storage_bucket`
- `storage_path`
- `mime_type`
- `file_size_bytes`
- `visibility_scope`

Indexes:
- index on `(organization_id, patient_id, created_at desc)`
- index on `(organization_id, encounter_id, created_at desc)`

#### prescriptions
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `provider_id`
- `encounter_id nullable`
- `medication_name`
- `dose`
- `frequency`
- `pharmacy_name`
- `status`
- `external_rx_id`

Indexes:
- index on `(organization_id, patient_id, created_at desc)`
- index on `(organization_id, provider_id, status)`

#### lab_orders
Key columns:
- `id`
- `organization_id`
- `patient_id`
- `encounter_id nullable`
- `ordered_by_provider_id`
- `lab_partner`
- `status`
- `ordered_at`

Indexes:
- index on `(organization_id, patient_id, ordered_at desc)`
- index on `(organization_id, status, ordered_at desc)`

#### lab_results
Key columns:
- `id`
- `organization_id`
- `lab_order_id`
- `result_status`
- `resulted_at`
- `result_summary jsonb`
- `raw_document_id nullable`

Indexes:
- index on `(organization_id, lab_order_id, resulted_at desc)`

#### workflows
Key columns:
- `id`
- `organization_id`
- `name`
- `workflow_type`
- `trigger_type`
- `definition jsonb`
- `is_active`

Indexes:
- index on `(organization_id, workflow_type, is_active)`

#### workflow_runs
Key columns:
- `id`
- `organization_id`
- `workflow_id`
- `subject_type`
- `subject_id`
- `status`
- `started_at`
- `completed_at`

Indexes:
- index on `(organization_id, workflow_id, started_at desc)`
- index on `(organization_id, subject_type, subject_id)`

#### integration.webhooks
Key columns:
- `id`
- `organization_id nullable`
- `source_system`
- `event_type`
- `delivery_id`
- `received_at`
- `status`
- `payload jsonb`

Indexes:
- unique index on `(source_system, delivery_id)`
- index on `(status, received_at desc)`

#### integration.integration_events
Key columns:
- `id`
- `organization_id`
- `source_system`
- `entity_type`
- `entity_id`
- `direction`
- `status`
- `occurred_at`
- `payload_ref`

Indexes:
- index on `(organization_id, source_system, occurred_at desc)`
- index on `(organization_id, entity_type, entity_id)`

### 14.12 Audit, Security, and Analytics Tables
#### audit.audit_logs
Purpose: append-only sensitive activity record.

Key columns:
- `id`
- `organization_id`
- `actor_user_id`
- `actor_role`
- `action`
- `resource_type`
- `resource_id`
- `occurred_at`
- `ip_address`
- `metadata jsonb`

Indexes:
- index on `(organization_id, occurred_at desc)`
- index on `(organization_id, actor_user_id, occurred_at desc)`
- index on `(organization_id, resource_type, resource_id)`

#### audit.security_events
Key columns:
- `id`
- `organization_id nullable`
- `user_id nullable`
- `event_type`
- `severity`
- `occurred_at`
- `details jsonb`

Indexes:
- index on `(severity, occurred_at desc)`
- index on `(organization_id, occurred_at desc)`

#### analytics.analytics_events
Key columns:
- `id`
- `organization_id`
- `user_id nullable`
- `event_name`
- `event_at`
- `properties jsonb`

Indexes:
- index on `(organization_id, event_name, event_at desc)`
- index on `(organization_id, user_id, event_at desc)`

#### analytics.kpi_daily_snapshots
Purpose: denormalized daily summary metrics.

Key columns:
- `id`
- `organization_id`
- `snapshot_date`
- `metric_name`
- `metric_value_numeric`
- `metric_value_json`

Constraints:
- unique index on `(organization_id, snapshot_date, metric_name)`

### 14.13 High-Value Relationships
- `users -> organization_memberships -> organizations`
- `users -> providers`
- `users -> patients` where patient portal accounts exist
- `patients -> appointments -> encounters -> clinical_notes`
- `patients -> allergies / medications / vital_signs / diagnoses / procedures`
- `patients -> care_plans -> care_tasks`
- `patients -> consents / insurance_plans / invoices / claims / documents / messages`
- `providers -> availability_rules / appointments / encounters / notes / prescriptions`
- `message_threads -> thread_participants -> messages`
- `workflows -> workflow_runs`
- `claims -> claim_events`
- `lab_orders -> lab_results`

### 14.14 Indexing and Query Optimization Strategy
- Every tenant-owned table needs an index beginning with `organization_id` for common scoped queries.
- Common timeline tables should use composite descending indexes such as `(organization_id, patient_id, created_at desc)`.
- Provider work queues should use indexes like `(organization_id, provider_id, status, scheduled_start)`.
- Use partial indexes for active rows such as open tasks, upcoming appointments, active memberships, and unsent reminders.
- Use trigram or full-text search only on user-facing search-heavy fields such as patient names, provider names, and document titles.
- Do not over-index write-heavy event tables; favor the 2-3 access paths we know will matter.
- Consider materialized views for dashboards instead of expensive transactional joins on every request.

### 14.15 Row-Level Security Strategy
- `organizations`: only super-admin or organization admins with explicit access.
- `organization_memberships`: users can read their own membership; tenant admins can read within tenant.
- `patients`: visible only to assigned providers, allowed staff, and the patient portal user for self-owned records where policy allows.
- `appointments` and `encounters`: visible by organization scope plus role/assignment rules.
- `clinical_notes`: provider-author/assigned-care-team visibility, patient visibility only when specifically allowed.
- `messages`: enforced through `thread_participants` membership checks.
- `billing`, `claims`, and `payments`: visible only to authorized finance/admin roles plus limited patient self-view.
- `audit` tables: read restricted to compliance/admin roles; write only through trusted server code.

### 14.16 Migration and Data Lifecycle Strategy
- Use SQL migrations under version control.
- Ship schema changes with forward-only migrations.
- Add seed data only for system roles, permissions, codes, and demo-safe fixtures.
- Add RLS policy tests for every sensitive table before feature completion.
- Archive or summarize high-volume analytics/integration tables on a schedule.
- Define retention windows for notifications, webhooks, audit logs, and analytics events.

### 14.17 Performance and Reliability Rules
- Keep transactional queries scoped and paginated by default.
- Never render provider dashboards from N+1 query patterns; prefer server-side aggregation or views.
- Use optimistic concurrency where note edits, task updates, or schedule changes can conflict.
- Keep JSONB for flexible metadata and template bodies, not for core relational joins.
- Precompute expensive dashboard metrics in background jobs when possible.
- Make webhook and integration processing idempotent with unique delivery keys.

## 15. API Groups
- `/auth`
- `/organizations`
- `/users`
- `/providers`
- `/patients`
- `/appointments`
- `/medical-records`
- `/clinical-notes`
- `/templates`
- `/care-plans`
- `/messages`
- `/notifications`
- `/prescriptions`
- `/billing`
- `/claims`
- `/documents`
- `/analytics`
- `/integrations`
- `/webhooks`

## 16. Delivery Sequence
### Stage 0: Setup and Validation
- Finalize organization model
- Finalize role model
- Confirm configurable specialty strategy, template model, and terminology approach
- Confirm vendor choices for email and SMS only if needed in MVP
- Create Supabase project and share credentials
- Define SLO targets, incident severity levels, and on-call ownership
- Finalize backup/PITR settings and target RPO/RTO
- Choose CI/CD pipeline and mandatory merge gates
- Confirm environments strategy: local, preview, staging, production

### Stage 1: Foundation
- Next.js app shell
- Auth
- Layouts
- Route guards
- Supabase integration
- Base schema and RLS
- Error handling and logging
- Organization branding, tenant configuration, and isolation baseline

### Stage 2: Patient and Provider Core
- Onboarding
- Scheduling
- Dashboard
- Patient chart
- Clinical notes
- Telehealth visit workflow without hard dependency on Daily/Twilio

### Stage 3: Continuity
- Messaging
- Care plans
- Tasks
- Notifications
- Admin basics
- Specialty configuration controls and template management
- Tenant-aware settings and white-label controls

### Stage 4: Revenue and Integrations
- Billing
- Dummy/manual payment flow
- Claims foundation placeholders
- Labs/interoperability scaffolding
- Analytics dashboards
- Stripe and video integrations only if phase scope expands

### Stage 5: Hardening
- QA pass
- Security pass
- Performance pass
- Pilot launch
- Load and stress test pass against expected peak concurrency
- Backup restore drill and failover simulation
- Incident response tabletop exercise and runbook validation
- Cost and quota review with alert thresholds
- Final compliance evidence review (access logs, policy tests, audit events)

### Stage 6: Third-Party Expansion
- Daily or Twilio integration
- Stripe production integration
- Claims and eligibility partner integration
- Labs and interoperability integrations

## 17. Definition of Done for Each Feature
- Product behavior is implemented exactly as defined in this document or updated scope notes.
- UI covers loading, empty, success, validation, and error states.
- Role and tenant boundaries are enforced.
- API schema is validated.
- Audit logging exists for sensitive actions.
- Tests are present at the right level.
- Documentation is updated.

## 18. What You Need to Provide From Supabase
These are the minimum Supabase details needed before implementation can move smoothly.

### Required Immediately
- Supabase project URL
- Supabase anon key
- Supabase service role key
- Supabase project reference ID
- Database password or connection string
- `DATABASE_URL` for pooled connections if we use ORM/query tooling
- `DIRECT_URL` for migrations if we use tools that require a direct connection

### Required for Team/CI Automation
- Supabase access token for CLI usage in CI or local automation
- Confirmation of the project region
- Confirmation of the pricing/compliance tier you selected

### Required in Dashboard Configuration
- Site URL
- Allowed redirect URLs
- Email auth settings
- Chosen auth providers, if any beyond email/password
- Storage bucket permissions strategy

### Strongly Recommended Before Build Starts
- Confirm the app is single organization at launch
- Confirm the specialty system should remain configurable rather than fixed to one specialty
- Confirm whether patient self-signup is open or invite-only
- Confirm whether providers are internal only or can be invited by admins
- Confirm whether you want magic link login for patients

## 19. Environment Variable Checklist
The full starter env file is in [.env.example](/Users/apple/Desktop/ai_project/.env.example).

From Supabase, you should at minimum fill:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_ACCESS_TOKEN`

## 20. Inputs Still Needed From You Before We Start Full Development
- Confirm the specialty configuration approach is enough for MVP and you do not need one specialty hardcoded now
- Confirm the MVP tenant model: multi-tenant from day one
- Confirm email vendor: Resend, SendGrid, or Mailtrap
- Confirm SMS vendor: Twilio or none for MVP
- Confirm payment approach: dummy/manual flow in MVP, Stripe later
- Confirm whether e-prescribing remains phase 2
- Confirm whether claims submission remains phase 2

## 21. Recommended Next Step
Once you fill the env values and answer the product choices above, this document can be used as the build contract for implementation. At that point we should start with:
1. Project scaffold
2. Auth and role model
3. Supabase schema baseline
4. Patient/provider/admin shells
5. Tenant bootstrap plus onboarding and scheduling vertical slice

## 22. Non-Functional Requirements and SLO Targets
Use these targets to guide architecture and release readiness.

- Availability SLO: 99.9% monthly for patient and provider core flows.
- API latency SLO: p95 under 400ms for standard reads and p95 under 700ms for standard writes under normal load.
- Error-rate SLO: under 1% 5xx for app APIs measured per 5-minute window.
- Data durability target: no committed data loss beyond defined RPO.
- Recovery objectives:
- `RPO <= 15 minutes` for transactional clinical and scheduling data.
- `RTO <= 60 minutes` for full platform recovery.
- Queue processing objective: webhook and async job backlog under 5 minutes during normal operation.
- Define error budget policy: freeze non-critical feature releases when SLO burn exceeds threshold.

## 23. CI/CD and Release Pipeline Requirements
- Protect `main` with required checks and at least one approving review.
- Required CI checks per PR:
- TypeScript typecheck
- Lint
- Unit/integration test suite
- E2E smoke tests for auth, tenant switching, scheduling, messaging
- Migration validation against clean database
- RLS policy test run
- Dependency and container/image vulnerability scan
- Secret scan on code and config
- Use preview environments for every PR with isolated database branches where possible.
- Require explicit migration review for destructive or lock-heavy SQL operations.
- Tag releases and keep release notes tied to scope, migrations, and rollback instructions.
- Keep deployment strategy blue/green or canary-capable for fast rollback.

## 24. Testing Strategy and Coverage Expectations
- Unit tests for domain services, validators, permission helpers, and utility logic.
- Integration tests for API handlers, Supabase queries/RPC, RLS policies, and edge functions.
- E2E tests for highest-risk user journeys:
- patient signup and onboarding
- provider encounter and note signing
- appointment booking/reschedule/cancel
- secure messaging
- billing invoice visibility and payment submission flow
- Regression tests for multi-tenant isolation and role escalation attempts.
- Contract tests for third-party adapters (email, SMS, video, payments, labs/FHIR placeholders).
- Performance tests:
- load test core read/write APIs
- concurrency tests for scheduling collision prevention
- soak tests for async workflows
- Accessibility tests in CI with keyboard and screen-reader focused smoke coverage.

## 25. Security and Compliance Operations Additions
- Enforce MFA for privileged roles and step-up authentication for high-risk actions.
- Use short-lived server credentials and rotate service keys on a defined schedule.
- Enforce least-privilege access for CI, support tooling, and operational scripts.
- Require structured audit events for all PHI access and permission changes.
- Encrypt PHI in transit and at rest; document any field-level encryption decisions for especially sensitive data.
- Enable WAF/rate limiting and bot protection on public/auth endpoints.
- Run dependency patching cadence with SLA by severity:
- critical within 24 hours
- high within 7 days
- medium within 30 days
- Maintain HIPAA-aligned controls evidence:
- access review records
- incident logs
- backup restore evidence
- policy test artifacts
- Confirm BAA status with required vendors before production PHI usage.

## 26. Backup, Disaster Recovery, and Data Lifecycle Hardening
- Enable automated backups and point-in-time recovery for production.
- Document restore process for full environment and table-level recovery scenarios.
- Run restore drills at least monthly and after major schema changes.
- Maintain immutable backup copies where feasible.
- Define data retention and purge schedules by domain:
- audit logs
- analytics events
- notifications
- documents
- integration payloads
- Support legal hold workflow to pause deletions when required.
- Validate cross-region recovery strategy if uptime or compliance requirements demand it.

## 27. Observability, Incident Response, and On-Call
- Standardize structured logging with correlation IDs across Next.js handlers, edge functions, and background jobs.
- Emit domain metrics for onboarding completion, booking success, visit completion, message delivery, and payment events.
- Maintain tracing coverage for core request paths to isolate latency and failures quickly.
- Alerting tiers:
- P1: auth outage, scheduling outage, PHI access control failure
- P2: degraded performance or major integration failure
- P3: non-critical functional degradation
- Maintain incident runbooks for top failure modes:
- auth/sign-in failures
- migration rollback
- webhook backlog or dead-letter recovery
- notification provider outage
- Perform incident postmortems with corrective actions and due dates.

## 28. Performance, Caching, and Scalability Controls
- Define caching policy per route and data class:
- static/public content via CDN caching
- user dashboards with short-lived cache or revalidation
- PHI-sensitive responses with no shared public cache
- Use cursor-based pagination for large tables and timeline feeds.
- For hot queries, use pre-aggregated views/materialized views refreshed by jobs.
- Set connection pooling and query timeout rules to protect database under load.
- Add idempotency keys for externally triggered writes (webhooks, payment callbacks, retries).
- Ensure background job queue supports retries, dead-letter handling, and visibility into stuck jobs.
- Validate horizontal scaling assumptions with load tests before pilot and before each major rollout.

## 29. Configuration and Secrets Management
- Keep environment-specific config in secure secret stores, not source control.
- Validate required env vars on startup; fail fast on missing critical secrets.
- Maintain separate secrets for local, preview, staging, and production.
- Rotate keys/tokens on a regular schedule and immediately after personnel changes or incidents.
- Track config changes with audit history and approval workflow.

## 30. Cost Governance and FinOps Baseline
- Define monthly budget targets for hosting, database, storage, messaging, monitoring, and analytics.
- Configure spend and quota alerts for Supabase, Vercel, Twilio, and other metered vendors.
- Track high-cost query and storage patterns and optimize quarterly at minimum.
- Set retention and archival policies to avoid unbounded growth in logs, analytics, and document storage.
- Review feature-level cost impact before enabling expensive integrations broadly.

## 31. Launch Readiness Exit Criteria
Production launch should require all of the following:

- SLO dashboards are live and alerting is verified.
- CI/CD quality gates are enforced on protected branches.
- Critical-path E2E tests are green in staging and production smoke.
- RLS and authorization tests pass for all sensitive domains.
- Backup restore drill completed with acceptable RPO/RTO.
- Incident runbooks reviewed and on-call ownership confirmed.
- Security/compliance evidence package is complete.
- Rollback plan tested for application deployment and database migration.
- Cost alerting and quota protections are active.
