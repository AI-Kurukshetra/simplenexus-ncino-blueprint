---
name: virtual-health-ui
description: Use this skill when designing, implementing, or refining UI for the virtual health platform in this repo. It applies to Next.js pages, React components, Tailwind styling, layout systems, design tokens, role-based dashboards, patient/provider/admin workflows, and screen-level UX decisions where healthcare-specific clarity, trust, accessibility, and workflow speed matter.
---

# Virtual Health UI

## Overview
This skill defines the UI rules for the virtual health platform so screens feel intentional, calm, and clinically usable instead of generic SaaS. Use it whenever work touches layouts, flows, component behavior, visual direction, or responsive states for patient, provider, admin, or developer-facing screens.

When working in this repo, read [NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md](/Users/apple/Desktop/ai_project/NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md) first for route, role, and feature expectations. This skill shapes how those requirements become UI.

## When To Use
- Building or updating pages under `src/app`
- Creating shared layout shells, navigation, headers, sidebars, and dashboards
- Designing form UX for onboarding, charting, scheduling, messaging, billing, or settings
- Choosing visual hierarchy, spacing, typography, color usage, or empty/loading/error states
- Converting product requirements into reusable screen sections and components
- Reviewing whether a screen feels safe, fast, and role-appropriate for healthcare use

## Core UI Direction
- The product should feel clean, human, and medically credible.
- Prefer warm neutrals, grounded blues, soft greens, and restrained accent colors over loud startup palettes.
- Avoid generic purple-heavy SaaS styling unless the repo already uses it.
- Visual density should differ by role: patient UI calmer and simpler, provider UI denser and faster, admin UI structured and data-forward.
- Important clinical information must stand out through hierarchy and contrast, not decorative effects.

## Role-Based Design Rules
### Patient UI
- Keep flows short, readable, and reassuring.
- Use plain language over clinical jargon where possible.
- Show one primary action per screen section.
- Provide obvious progress indicators for onboarding and booking.
- Billing, records, and messages should be easy to find from the dashboard.

### Provider UI
- Optimize for speed, scanning, and reduced charting friction.
- Surface high-value data early: allergies, meds, reason for visit, pending tasks, recent encounters.
- Keep actions close to context so providers do not bounce between screens unnecessarily.
- Use side panels, sticky action areas, and dense but readable tables where useful.

### Admin UI
- Favor clarity and auditability over visual flourish.
- Settings screens should explain impact before dangerous changes.
- Analytics and billing screens should privilege filters, summaries, and traceability.

## Screen Construction Checklist
- Start with the user role and the single main job of the screen.
- Define the primary action before styling secondary content.
- Include loading, empty, validation, error, and success states.
- Make mobile behavior explicit, especially for dashboards, forms, and tables.
- Use consistent section spacing and heading hierarchy.
- Prefer reusable domain components over one-off markup.

## Layout Patterns
### Shared Shells
- Patient shell: light navigation, high readability, large tap targets
- Provider shell: persistent navigation, quick actions, compact summaries
- Admin shell: wider content areas, filters, bulk actions, audit context

### Page Anatomy
- Header with title, status, and primary action
- Summary strip for key metrics or patient facts where relevant
- Main content area with 1-3 dominant sections
- Secondary side panel only when it reduces navigation friction
- Footer actions only for multi-step or document-style flows

## Form Rules
- Use step-based forms for long patient intake flows.
- Group fields by user intent, not database model.
- Show inline validation close to the field.
- Preserve draft progress wherever the user would reasonably expect it.
- For PHI-heavy forms, keep visual noise low and labels very clear.
- Never hide required information behind ambiguous accordions.

## Data-Dense Screen Rules
- Use cards for patient-facing summaries and tables/lists for provider/admin operational views.
- On charts and timelines, sort by clinical relevance first and chronology second when needed.
- Highlight critical data like allergies, urgent tasks, denied claims, and failed integrations with consistent severity patterns.
- Avoid over-animating tables or chart screens.

## Motion and Polish
- Use a few meaningful transitions such as route-level fade/slide and staggered content reveal.
- Avoid decorative motion on critical clinical tasks.
- Loading states should feel calm and informative, not flashy.

## Accessibility and Trust Rules
- Meet WCAG AA contrast expectations.
- All flows must be keyboard-usable.
- Focus states must be visible and intentional.
- Error messaging should be clear and non-blaming.
- Use plain-language labels whenever possible for patient screens.
- Never rely on color alone to communicate status.

## Implementation Guidance
- Prefer design tokens and CSS variables over scattered one-off values.
- Reuse `shadcn/ui` primitives, but customize them to match this product instead of leaving defaults untouched.
- Keep Tailwind class composition readable; extract repeated patterns into components.
- For React, prefer straightforward state models and server-driven data where possible.
- Do not introduce visual complexity that conflicts with clinical speed or accessibility.

## Example Requests This Skill Should Handle
- "Design the patient onboarding flow for this app."
- "Create a provider dashboard that surfaces today’s visits and pending tasks."
- "Refine the billing screen so admin users can understand claim failures quickly."
- "Turn this rough page into a healthcare-grade screen using the project’s UI rules."

## References
- Use [NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md](/Users/apple/Desktop/ai_project/NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md) for product-specific route, feature, and role expectations.
- Use [screen-inventory.md](/Users/apple/Desktop/ai_project/skills/virtual-health-ui/references/screen-inventory.md) when turning modules into concrete page layouts and route-level UI decisions.
