---
name: implementation-progress-tracker
description: Use this skill when updating or reviewing complete.md so project status remains aligned with the master plan stages, modules, dependencies, blockers, and change log.
---

# Implementation Progress Tracker

## Purpose
Keep `complete.md` accurate, current, and decision-useful as implementation progresses.

## When To Use
- After any meaningful implementation step.
- When stage/module status changes.
- During weekly status reviews.
- Before planning next sprint priorities.

## Source of Truth
- `NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md` for scope and stage definitions.
- `AIDLC_IMPLEMENTATION_PLAN_NEXTJS_SUPABASE.md` for phase intent and quality gates.
- Repository state (code, migrations, tests, CI config) for what is actually done.

## Update Workflow
1. Verify what changed in code/docs since the last update.
2. Update `Snapshot` and `Stage Tracker`.
3. Update `Module Tracker` and `Definition of Done Checks`.
4. Record blockers/risks with mitigation and owner.
5. Append a row to `Change Log` with date and exact change made.

## Quality Rules
- Never mark an item complete without tangible evidence in repo artifacts.
- Keep status labels consistent (`[ ]`, `[-]`, `[x]`, `[!]`).
- Prefer small, frequent updates over large batch updates.
- Keep notes concrete enough that a new engineer can resume work quickly.

