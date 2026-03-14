---
name: supabase-rls-guardian
description: Use this skill when creating or changing Supabase schema, migrations, RLS policies, or tenant-isolation logic. It enforces secure-by-default database changes with policy tests, migration safety checks, and cross-tenant leak prevention.
---

# Supabase RLS Guardian

## Purpose
Protect tenant isolation and PHI boundaries whenever database changes are made.

## When To Use
- New table or schema creation
- Migration updates or backfills
- RLS policy creation or modification
- Query/RPC changes that touch tenant-scoped data
- Security reviews for database-level access paths

## Workflow
1. Identify affected tables and classify them as `tenant-scoped`, `global`, or `sensitive`.
2. Ensure `organization_id` and required audit columns are present for tenant-scoped tables.
3. Add or update RLS policies for read/write paths by role and tenant boundary.
4. Add policy tests for allow/deny cases, including cross-tenant denial checks.
5. Validate migration safety:
- rollback strategy
- lock-risk awareness
- index and query-impact review
6. Verify server-side code does not bypass intended policy boundaries.

## Required Checks
- No tenant table ships without RLS.
- No policy permits cross-tenant read/write.
- Privileged operations are server-restricted and auditable.
- Sensitive tables include least-privilege read rules.
- Migrations include clear forward and rollback intent.

## Output Format
- Summary of schema/policy changes
- Risk notes (if any)
- Evidence of tests added or run
- Explicit statement: `tenant isolation preserved` or `risk detected`

