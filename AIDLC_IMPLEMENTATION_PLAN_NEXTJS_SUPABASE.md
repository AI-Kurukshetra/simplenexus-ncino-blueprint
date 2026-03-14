# AIDLC Implementation Plan
## Project: API-First Virtual Health Platform (Next.js + Supabase)

## 1. Document Intent
This document is the full phase-wise AIDLC (AI/Agile Integrated Development Lifecycle) implementation plan for building a production-grade virtual health platform using Next.js and Supabase, aligned to your SRS blueprint.

Primary intent:
- Convert high-level SRS into executable delivery phases.
- Define clear ownership, entry/exit criteria, and quality gates.
- Cover frontend, backend, database, security, compliance, integrations, testing, and go-live.
- Ensure smooth, medical-grade UX for patient and provider workflows.
- Ensure blueprint coverage for core EHR, e-prescribing, labs, interoperability, analytics, mobile access, and developer platform readiness.

## 2. Delivery Principles (Non-Negotiable Bolts)
- Tenant-safe by design: Every data path is organization-scoped.
- RLS first: No PHI query without row-level authorization policy.
- API contract discipline: Typed request/response schemas (Zod/OpenAPI).
- Security baseline: MFA for staff, audit logging, least privilege access.
- Incremental shipping: Weekly demoable slices, no long dark phases.
- Clinical workflow focus: Optimize provider time, reduce charting friction.
- Performance guardrails: Fast first-load and responsive charting screens.
- Observability everywhere: traceability for errors, latency, and user flows.
- API product mindset: versioning, developer docs, rate limits, and usage analytics are first-class.
- Interoperability by design: internal schemas should map cleanly to FHIR-aligned resources.
- Mobile-inclusive care delivery: responsive web, PWA support, and offline-tolerant workflows are planned deliberately.

## 3. Target Architecture
- Frontend: Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui.
- Backend: Next.js Route Handlers + Server Actions + Supabase Edge Functions.
- Data Layer: Supabase Postgres, SQL migrations, RPC functions.
- Auth: Supabase Auth + custom role model (patient/provider/admin/super-admin).
- Storage: Supabase Storage for clinical documents and attachments.
- Realtime: Supabase Realtime for chat/notifications/live updates.
- Video: HIPAA-eligible provider (Daily/Twilio) with signed session tokens.
- E-Prescribing: Surescripts-compatible integration layer with safety checks.
- Billing: Stripe for payments; claims integration in later phases.
- Interoperability: FHIR R4 mapping layer + adapter services for external EHR/HIE/lab partners.
- Mobile: Next.js PWA baseline; React Native apps when core workflows stabilize.
- API Platform: developer portal, API keys/service accounts, rate limits, and usage analytics.
- DevOps: Vercel + Supabase + CI/CD + Sentry + PostHog.

## 4. Phase Plan Overview
- Phase 0: Program Initialization and Requirement Lock
- Phase 1: Foundation and Secure Platform Setup
- Phase 2: Core Clinical MVP Build
- Phase 3: Care Continuity and Communication Expansion
- Phase 4: Revenue, Billing, and Claims Foundation
- Phase 5: Integrations, Analytics, and Operational Intelligence
- Phase 6: Hardening, Compliance Readiness, and Launch
- Phase 7: Post-Launch Optimization and Scale

---

## Phase 0: Program Initialization and Requirement Lock
### Intent
Create clarity before coding. Freeze MVP scope, risk profile, domain model, compliance expectations, and delivery cadence.

### Inputs
- SRS blueprint PDF
- Stakeholder priorities
- Team capacity and timeline constraints

### Workstreams
- Product discovery workshops: patient, provider, admin journeys.
- Feature slicing: must-have vs important vs innovative.
- Domain glossary and business rules.
- Compliance scope confirmation (HIPAA, consent, audit requirements).
- Initial architecture decision records (ADRs).
- Specialty focus selection for MVP (for example primary care or mental health).
- Vendor due diligence for video, eRx, labs/imaging, eligibility, SMS/email, and identity verification.

### Bolts (Execution Checklist)
- Define MVP boundary with explicit out-of-scope list.
- Build user role matrix and permission boundaries.
- Define North Star metrics and phase KPIs.
- Finalize vendor shortlist (video, SMS/email, payments, labs, eRx, insurance eligibility, identity verification).
- Build blueprint coverage matrix: feature, phase, owner, dependency, and compliance notes.

### Deliverables
- PRD v1 + user story map
- System context diagram
- Data model draft v1
- API surface draft v1
- Risk register v1
- Release roadmap (16-week MVP plan)

### Exit Criteria
- MVP scope signed off by product + engineering.
- Architecture direction approved.
- Compliance assumptions documented.

---

## Phase 1: Foundation and Secure Platform Setup
### Intent
Stand up a secure, scalable base with role-aware auth, tenant isolation, and engineering standards.

### Frontend Tasks
- Set up design system tokens (medical palette, spacing, typography).
- Build shared layout shells: patient/provider/admin.
- Configure app routing and guarded sections.
- Add accessibility baseline (semantic structure, focus states, keyboard flow).
- Establish responsive PWA shell and offline-state UX patterns for patient/provider critical flows.

### Backend Tasks
- Define API namespace structure and conventions.
- Implement server-side auth helpers and session checks.
- Establish error handling model and response contracts.
- Define API versioning, service-account patterns, webhook signing, and rate-limit conventions.
- Scaffold developer-facing API docs and sandbox strategy.

### Database Tasks
- Create core tables:
  - organizations, users, roles, permissions
  - patients, providers
  - audit_logs, security_events
- Create foundational catalogs for templates, workflows, billing codes, and notification preferences.
- Implement RLS policies for all existing tables.
- Add migration workflow and seed data strategy.

### Security and Compliance Tasks
- Configure secrets management and key rotation policy.
- Enable MFA for privileged users.
- Build audit logging middleware for PHI actions.
- Document BAA requirements for all vendors.
- Define consent versioning model and identity verification evidence handling rules.

### DevOps Tasks
- CI/CD setup with preview deployments.
- Static checks: lint, typecheck, test gates.
- Monitoring setup: Sentry, uptime checks, core dashboards.
- Add API usage telemetry and alerting for auth, rate-limit, and webhook failures.

### Bolts
- No API route merged without schema validation.
- No table merged without RLS policy and policy tests.
- No privileged action without audit trail.

### Deliverables
- Running app skeleton with auth and role-based route guards.
- Supabase schema baseline + RLS baseline.
- CI/CD pipeline and observability baseline.

### Exit Criteria
- Security baseline checklist passed.
- Tenant isolation tests green.
- Team can deploy safely to staging.

---

## Phase 2: Core Clinical MVP Build
### Intent
Deliver end-to-end clinical value: onboarding, scheduling, tele-visit, documentation, and patient/provider portals.

### Feature Streams
1. Patient Registration and Onboarding
- Intake profile, demographics, medical history, medications, allergies, and baseline vitals forms.
- Insurance details capture plus real-time eligibility/benefits verification.
- Identity validation for high-risk or regulated flows.
- Consent capture workflow with versioning and longitudinal tracking.

2. Appointment Scheduling
- Provider availability and slot management.
- Booking, rescheduling, cancellation.
- Reminder workflows (email/SMS).
- Calendar integrations for provider workflows and external calendar sync.

3. Video Consultation
- Session creation, join flow, pre-check.
- In-visit status and post-visit completion.
- Policy-controlled recording, screen sharing, and in-call documentation support.

4. Longitudinal Health Record
- Patient chart with medical history, medications, allergies, diagnoses, procedures, vitals, documents, and care plans.
- Encounter timeline and reusable clinical templates.

5. Provider Dashboard
- Daily queue, patient summary snapshot, pending tasks.
- Fast access to notes and care plan actions.
- Treatment planning tools and quick-launch charting actions.

6. Patient Portal
- Upcoming appointments, visit history, documents, basic messaging.
- Record access, care plan visibility, and self-service profile/insurance updates.

7. Prescription Management
- E-prescribing workflow, refill requests, pharmacy selection, and medication reconciliation.
- Drug interaction/allergy safety checks and prescription auditability.

8. Clinical Documentation
- SOAP notes templates and encounter-linked notes.
- Draft autosave and finalize/sign workflow.
- Dictation/voice-to-text readiness for provider documentation acceleration.

### Backend/API
- Route handlers and RPC for:
  - /auth
  - /providers
  - /patients
  - /appointments
  - /medical-records
  - /clinical-notes
  - /care-plans
  - /prescriptions
  - /templates
- Idempotency for appointment creation/update flows.
- Contract scaffolding for /organizations, /users, and /documents.

### Database
- appointments, encounters, clinical_notes, consents, documents, notifications.
- prescriptions, medications, allergies, vital_signs, diagnoses, procedures, care_plans, templates, insurance_plans.
- Index strategy for schedule and patient timeline queries.

### UX Smoothness Bolts
- 3-step max scheduling flow.
- Autosave every 5-10 seconds for notes.
- Prefetch dashboard data for perceived speed.
- Load skeletons and optimistic UI for interaction-heavy screens.
- Mobile-first chart and portal layouts for common visit-day flows.

### Deliverables
- MVP clinical workflows functional in staging.
- Demo scripts for provider and patient journeys.
- Core patient chart and prescription flow validated in staging.

### Exit Criteria
- Book-to-consult-to-note cycle works without manual data fixes.
- Core chart review and prescription workflow operate safely with audit coverage.
- Provider usability validation complete.
- E2E critical path tests passing.

---

## Phase 3: Care Continuity and Communication Expansion
### Intent
Reduce care gaps with messaging, care plans, team coordination, and follow-up workflows.

### Features
- Secure messaging (patient-provider threads).
- Care plan authoring and task tracking.
- Team-based visibility controls.
- Document management enhancements.
- Automated reminders and follow-up nudges.
- Care team coordination with handoff protocols and shared task ownership.
- Workflow automation for care pathways, task assignment, and protocol-driven follow-up.
- Multi-channel communication hub (in-app, email, SMS) with patient preference controls.
- Real-time language translation support for messaging and visit-assist surfaces.
- PWA/offline support for common patient and provider workflows; native mobile scope validation.

### Backend/Database
- message_threads, messages, care_plans, care_tasks, referrals, workflows, workflow_runs.
- Realtime subscriptions with scoped channels.
- Notification orchestration service.
- Assignment rules and automation jobs for reminders, escalations, and handoffs.

### Bolts
- Message access strictly role and assignment scoped.
- Every care task has owner, due date, and state transitions.
- Follow-up automation is retry-safe and idempotent.
- Communication preferences and translation workflows must respect consent, language, and PHI boundaries.

### Exit Criteria
- End-to-end continuity workflow proven for at least one specialty.
- Cross-role handoff, automation, and patient messaging flows validated without data leakage.

---

## Phase 4: Revenue, Billing, and Claims Foundation
### Intent
Enable reliable revenue workflows and financial traceability.

### Features
- Invoices and payment collection.
- Insurance policy capture and real-time eligibility/benefits verification.
- Claim draft lifecycle (creation, submission, status tracking, denial flags).
- Billing dashboard for admin users.
- Billing code capture (CPT/ICD placeholders initially) and reconciliation tooling.

### Backend/Database
- invoices, payments, insurance_policies, claims, claim_events, billing_codes.
- Webhook ingestion for payment events with signatures.
- Reconciliation jobs for payment and invoice states.
- Eligibility verification adapters and payer-response audit logs.

### Bolts
- All money events are immutable and auditable.
- Payment webhooks idempotent with replay protection.
- Billing role cannot access unrelated PHI details.

### Exit Criteria
- Financial data consistency checks green.
- Billing operations validated by admin test scenarios.

---

## Phase 5: Integrations, Analytics, and Operational Intelligence
### Intent
Connect external systems and provide operational insight for product and clinical outcomes.

### Integrations
- Lab and diagnostic order/result interface (starting with one partner).
- Webhook framework for external event consumers.
- FHIR R4 interoperability hub for external EHR, HIE, and payer exchanges.
- API management console: documentation, sandbox access, auth patterns, rate limits, and usage analytics.
- Chronic care management and remote patient monitoring foundation.

### Analytics
- Provider productivity metrics.
- Patient engagement and portal adoption metrics.
- Appointment funnel and no-show analysis.
- System SLO dashboards (latency, error rates, uptime).
- Clinical outcomes, regulatory reporting, and quality-measure dashboards (for example HEDIS/CMS-aligned tracking).
- API adoption and integration success metrics.
- Revenue per provider, claims accuracy/speed, and onboarding time for new organizations.

### Database/Processing
- analytics_events and aggregate tables.
- Scheduled jobs for KPI snapshots.
- Data retention windows per compliance policy.
- lab_orders, lab_results, interoperability_events, device_readings, quality_measures, sdoh_assessments.

### Bolts
- Analytics pipelines cannot leak PHI into unsecured sinks.
- Define one owner per KPI metric and dashboard.
- External exchange events must be replayable, traceable, and mapped to canonical internal records.

### Exit Criteria
- Leadership dashboard live with trusted definitions.
- At least one external integration stable in staging/prod pilot.
- At least one lab/diagnostic partner and one interoperability exchange validated end to end.

---

## Phase 6: Hardening, Compliance Readiness, and Launch
### Intent
Prove reliability, security posture, and operational readiness before broad release.

### Testing and Quality
- Full regression suite (unit/integration/E2E).
- Performance testing on peak booking + consultation windows.
- Security testing: auth bypass, RLS bypass, injection vectors.
- Backup/restore and disaster recovery drills.

### Compliance and Ops
- Finalize policies: access control, incident response, retention, audit review.
- Conduct access review and permission pruning.
- Go-live runbook and on-call rotations.

### Bolts
- No P0/P1 unresolved vulnerabilities at launch.
- Recovery point and recovery time objectives validated.
- Audit trails queryable by compliance team.

### Exit Criteria
- Launch readiness checklist signed off.
- Pilot cohort onboarded successfully.

---

## Phase 7: Post-Launch Optimization and Scale
### Intent
Improve outcomes, reduce costs, and prepare for advanced capabilities.

### Streams
- UX refinements based on real provider/patient usage.
- Query/index tuning and caching strategy improvements.
- Multi-tenant administration enhancements.
- Controlled rollout of advanced features (AI documentation assist, risk scoring).
- Native mobile apps if PWA usage validates deeper offline/mobile needs.
- Population health, chronic care management, and RPM expansion.
- AI clinical decision support, predictive analytics, and automated prior authorization evaluation.
- SDOH workflows, digital therapeutics, genomics, and specialty-specific innovation pilots.

### Bolts
- Feature flags for all high-risk feature rollouts.
- A/B test framework for UX or workflow changes.
- Monthly architecture review for bottlenecks and debt.

### Exit Criteria
- Sustained KPI improvements over two release cycles.

---

## 5. Cross-Phase Work Breakdown (Frontend, Backend, DB)
### Frontend
- Role-specific app shells and navigation.
- High-performance forms with validation and autosave.
- Appointment flows, timeline views, document viewer, messaging UI.
- Accessibility and mobile responsiveness from phase 1 onward.
- PWA capabilities, offline-state handling, and eventual native mobile component reuse.

### Backend
- Modular domain services with strict schema contracts.
- Edge Functions for third-party integration and sensitive processing.
- Background jobs for reminders, reconciliation, and analytics aggregation.
- Webhook ingestion, API key/service-account support, developer portal integrations, and interoperability adapters.

### Database
- SQL migrations under version control.
- RLS + policy tests as mandatory gate.
- Materialized views/aggregates for analytics.
- Archival and retention strategy for large event tables.
- Canonical clinical entities for medications, allergies, vitals, diagnoses, procedures, prescriptions, labs, and workflows.

## 6. Expanded Canonical Domain Model and API Surface
### Core Domain Entities
- Patients, Providers, Organizations, Users, Roles, Permissions
- Appointments, Encounters, Medical_Records, Clinical_Notes, Templates
- Prescriptions, Medications, Allergies, Vital_Signs, Diagnoses, Procedures
- Care_Plans, Care_Tasks, Referrals, Workflows, Workflow_Runs
- Lab_Orders, Lab_Results, Documents, Messages, Notifications
- Insurance_Plans, Claims, Claim_Events, Payments, Billing_Codes
- Consent_Forms, Audit_Logs, Security_Events, Analytics_Events
- Interoperability_Events, Device_Readings, SDOH_Assessments, Quality_Measures

### API Endpoint Groups
- /auth, /organizations, /users, /providers, /patients
- /appointments, /medical-records, /clinical-notes, /care-plans, /templates
- /prescriptions, /billing, /claims, /lab-orders, /lab-results
- /messaging, /notifications, /documents, /analytics, /workflows
- /integrations, /webhooks

## 7. Quality Gates Per PR
- Lint, typecheck, unit tests pass.
- API contract test pass.
- Security check pass (no secret leakage, dependency audit).
- RLS test pass for touched tables.
- Observability hooks present for new critical flows.
- Endpoint docs, rate-limit expectations, and audit impact documented for new public/API-facing surfaces.

## 8. Suggested 16-Week MVP Timeline
- Weeks 1-2: Phase 0 completion + Phase 1 kickoff.
- Weeks 3-5: Phase 1 completion.
- Weeks 6-10: Phase 2 core implementation.
- Weeks 11-13: Phase 3 partial (messaging + care plans).
- Weeks 14-15: Phase 6 hardening for MVP launch candidate.
- Week 16: Pilot launch + stabilization sprint.

## 9. Roles and Ownership
- Product Lead: scope, prioritization, acceptance.
- Tech Lead: architecture, quality gates, risk management.
- Full-stack Engineers: feature implementation and tests.
- QA Engineer: regression automation, E2E coverage.
- Compliance Advisor: HIPAA controls and evidence readiness.
- DevOps Owner: CI/CD, environments, observability, incident readiness.
- Integration Owner: vendor onboarding, interoperability contracts, sandbox reliability.

## 10. Risk Register (Initial)
- R1: Scope creep from advanced features early.
  - Mitigation: strict MVP scope gate and change control.
- R2: Security/compliance debt accumulation.
  - Mitigation: compliance tasks embedded in each phase.
- R3: Integration delays (labs/claims/eRx).
  - Mitigation: isolate via Edge Functions and fallback mocks.
- R4: Provider UX friction in charting.
  - Mitigation: weekly clinician usability tests.
- R5: Performance degradation with growth.
  - Mitigation: performance budgets and profiling cadence.
- R6: Public API abuse or integration instability.
  - Mitigation: rate limits, signed webhooks, sandbox environments, and usage monitoring.
- R7: Clinical safety gaps in prescriptions or automation.
  - Mitigation: human-in-the-loop reviews, safety checks, audit trails, and staged rollout.

## 11. Success Metrics and Commercial Readiness
- API response time and uptime
- Patient engagement and portal adoption
- Provider satisfaction and clinical documentation time reduction
- Revenue per provider per month
- Claims processing accuracy and speed
- Time-to-launch for new healthcare organizations
- Integration success rate and API usage growth
- Security incident frequency and compliance audit outcomes
- White-label readiness, sandbox reliability, and developer onboarding success

## 12. Definition of Done (Global)
A feature is done only when:
- Business acceptance criteria are met.
- Unit + integration + E2E tests are updated and green.
- Observability and audit hooks are in place.
- RLS and role checks are validated.
- Documentation updated (API, runbook, release note).
- Public/integration-facing features include usage controls, support notes, and failure handling.

## 13. Next Immediate Actions (Execution Kickoff)
1. Finalize MVP story list from Phase 2 and Phase 3 subset.
2. Build schema migration pack v1 with RLS policies.
3. Set up monorepo/project skeleton with CI/CD and env strategy.
4. Build auth + role guard slice as first vertical delivery.
5. Start weekly clinical UX review with clickable prototypes.
6. Add blueprint coverage tracker for eRx, labs, interoperability, mobile, analytics, and developer API surfaces.
