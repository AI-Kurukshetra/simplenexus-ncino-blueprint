# Screen Inventory

Use this file when a request is about designing or implementing concrete screens from the master plan. It maps the main product modules to the screens that should exist in the Next.js application.

## Patient Screens
- Dashboard: next appointment, care tasks, unread messages, billing snapshot, profile completion
- Onboarding wizard: demographics, medical history, medications, allergies, insurance, consent, review
- Appointments list: upcoming, past, reschedule, cancel, join visit
- Appointment detail: visit status, instructions, reminders, documents, post-visit summary
- Messages: secure threads, attachments, unread states
- Records: visit history, care plans, documents, patient-visible notes or summaries
- Billing: invoices, payment status, manual/dummy payment action, insurance summary
- Settings: profile, communication preferences, password, consent review

## Provider Screens
- Dashboard: today queue, pending charting, urgent follow-ups, task summary
- Schedule: calendar/day view, availability controls, appointment filters
- Patient list: search, filters, assigned patients, quick actions
- Patient chart: summary, timeline, medications, allergies, vitals, diagnoses, procedures, documents, care plans
- Encounter view: active visit workspace, quick chart access, post-visit actions
- Note editor: template picker, autosave, sign/finalize, amendment trail
- Messages: patient/provider conversations, thread filters, escalation markers
- Tasks: assigned tasks, due dates, handoff status, workflow items
- Templates: note templates, intake templates, care-plan templates

## Admin Screens
- Dashboard: org KPIs, user counts, queue health, alert summaries
- Organization settings: branding, business details, specialty configuration, policies
- Provider management: invites, roles, activation state, schedule access
- Patient operations: search, support actions, intake status, consent status
- Workflow management: automation rules, task templates, reminders
- Billing operations: invoice monitoring, claim placeholders, payment state
- Analytics: productivity, engagement, funnel, revenue-health, compliance metrics
- Audit center: sensitive actions, filterable logs, export readiness
- Integrations: email/SMS status, future video/payment/lab integration placeholders

## Shared UI Expectations
- Every screen must define loading, empty, success, and error states.
- Patient screens should emphasize reassurance and clarity.
- Provider screens should emphasize speed and scanability.
- Admin screens should emphasize control, filters, and auditability.
- Mobile behavior must be explicit for all high-frequency screens.
