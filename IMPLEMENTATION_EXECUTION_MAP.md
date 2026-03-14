# Implementation Execution Map and Agent Usage

This file defines exactly which Markdown file or skill agent to use, when to use it, and how implementation is tracked end to end.

## 1) Files and Agents: When to Execute

| File / Agent | Role | Execute When | Expected Output |
|---|---|---|---|
| `NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md` | Master build contract and scope baseline | Before starting any stage/module and before closing any major feature | Scope-aligned implementation decisions |
| `AIDLC_IMPLEMENTATION_PLAN_NEXTJS_SUPABASE.md` | Phase execution strategy and quality gates | During sprint/stage planning and gate reviews | Phase-aligned delivery tasks and sequencing |
| `complete.md` | Single source of truth for progress | After every meaningful implementation step (code, schema, API, infra, docs) | Updated status, blockers, evidence, and change log |
| `$virtual-health-ui` (`skills/virtual-health-ui/SKILL.md`) | UI/UX implementation and refinement rules | Any screen, layout, form, dashboard, or responsive behavior change | Healthcare-grade UI that matches role-based UX rules |
| `skills/virtual-health-ui/references/screen-inventory.md` | Concrete screen inventory | When translating modules/routes into specific pages | Complete and consistent screen coverage |
| `skills/virtual-health-ui/agents/openai.yaml` | Invocation metadata for UI skill chip/prompt | When invoking the UI skill via agent UX | Consistent prompting and skill activation |
| `$api-contract-enforcer` (`skills/api-contract-enforcer/SKILL.md`) | API schema, versioning, idempotency, error contracts | Any new/updated route handler, webhook, or contract change | Stable API contract plus tests |
| `$supabase-rls-guardian` (`skills/supabase-rls-guardian/SKILL.md`) | Database schema + RLS safety | Any migration, policy, or tenant-bound query update | Tenant-safe schema/policy changes with checks |
| `$enterprise-readiness-audit` (`skills/enterprise-readiness-audit/SKILL.md`) | Enterprise gap audit and readiness scoring | End of each stage and before pilot/launch gates | Prioritized risk list and next enterprise actions |
| `$implementation-progress-tracker` (`skills/implementation-progress-tracker/SKILL.md`) | Tracker hygiene and status discipline | Every time `complete.md` is updated | Accurate progress state and audit trail |

## 2) Stage-Based Execution Sequence

| Stage | First Read | Build-Time Skills | Closeout/Gate |
|---|---|---|---|
| Stage 0 | Master Plan sections 16, 18, 20, 22-31 + AIDLC Phase 0/1 | `$implementation-progress-tracker` | Update `complete.md` snapshot, dependencies, and decisions |
| Stage 1 | Master Plan sections 8.1, 12, 13, 14, 15 | `$supabase-rls-guardian`, `$api-contract-enforcer`, `$virtual-health-ui` | Enterprise mini-audit + DoD checks updated |
| Stage 2 | Master Plan sections 8.2-8.7 + route map | `$virtual-health-ui`, `$api-contract-enforcer`, `$supabase-rls-guardian` | Critical-path E2E and tracker evidence updated |
| Stage 3 | Master Plan sections 8.8-8.9, 8.13, 8.15 | `$virtual-health-ui`, `$api-contract-enforcer`, `$supabase-rls-guardian` | Messaging/task security and continuity checks logged |
| Stage 4 | Master Plan sections 8.10-8.12, 8.14 | `$api-contract-enforcer`, `$supabase-rls-guardian`, `$virtual-health-ui` | Billing/integration controls and test evidence logged |
| Stage 5 | Master Plan sections 22-31 + AIDLC Phase 6 | `$enterprise-readiness-audit`, `$implementation-progress-tracker` | Launch-readiness checklist status updated |
| Stage 6 | Expansion sections in Master Plan + AIDLC Phase 7 | Skill mix by workstream | Post-launch optimization and governance tracking |

## 3) Task-to-Agent Trigger Rules

| Task Type | Use This Agent First | Then Use |
|---|---|---|
| UI screen, workflow UX, layout, form behavior | `$virtual-health-ui` | `$implementation-progress-tracker` |
| API endpoint, schema validation, response shape, webhook | `$api-contract-enforcer` | `$implementation-progress-tracker` |
| Table/migration/RLS/policy/tenant isolation work | `$supabase-rls-guardian` | `$implementation-progress-tracker` |
| Stage readiness, enterprise gaps, launch risk review | `$enterprise-readiness-audit` | `$implementation-progress-tracker` |
| Mixed change (UI + API + DB) | `$supabase-rls-guardian` | `$api-contract-enforcer`, `$virtual-health-ui`, `$implementation-progress-tracker` |

## 4) How Every Implementation Is Tracked

Use `complete.md` as the operational log with this mandatory evidence model:

1. Create or update a work item in `Active Work`.
2. Assign ID format: `STG{n}-MOD{8.x}-TASK-{nnn}`.
3. Link implementation evidence:
   - changed file paths
   - migration IDs (if any)
   - test proof (what passed/failed)
   - risk or blocker note (if present)
4. Update statuses in:
   - `Stage Tracker`
   - `Module Tracker`
   - `Definition of Done Checks`
5. Add or update `Blockers / Risks` same day if any new risk appears.
6. Append one row to `Change Log` for every meaningful update.

## 5) Tracking Cadence

- Per PR or meaningful change: update `complete.md` immediately.
- Daily: verify snapshot, active work, and blockers are current.
- Weekly: fill the weekly update template in `complete.md`.
- Stage gate: run `$enterprise-readiness-audit`, then update launch/hardening readiness status.

## 6) Canonical Precedence and Duplicate Handling

Use this order if two files appear to overlap:

1. `NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md` for scope and implementation contract.
2. `AIDLC_IMPLEMENTATION_PLAN_NEXTJS_SUPABASE.md` for phase execution strategy.
3. `complete.md` for live status and evidence.

Duplicate policy:
- Remove only exact duplicates or clearly obsolete copies (`copy`, `(1)`, `_old`, `_backup`) after verification.
- Do not remove complementary documents that serve different purposes.
- Audit result on 2026-03-14: no exact duplicate files detected in workspace.
