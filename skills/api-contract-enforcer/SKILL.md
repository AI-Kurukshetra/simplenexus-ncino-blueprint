---
name: api-contract-enforcer
description: Use this skill when building or updating API routes, handlers, or integration endpoints. It enforces strong request/response contracts with Zod and OpenAPI alignment, API versioning discipline, idempotency for retried writes, and consistent error semantics.
---

# API Contract Enforcer

## Purpose
Keep APIs predictable, safe, and evolvable across internal and external consumers.

## When To Use
- New API endpoint or route handler
- Request/response schema changes
- Webhook endpoints and retried write paths
- API versioning or deprecation work
- Error handling and status code normalization

## Workflow
1. Define input/output schemas using `zod`.
2. Validate all external input at boundary (query, params, body, headers).
3. Standardize response envelope and error model.
4. For write endpoints, design idempotency behavior and key strategy.
5. Ensure versioning rules are followed (`/v1`, additive-first changes, deprecation notes).
6. Update API documentation contract (OpenAPI or equivalent source docs).
7. Add tests:
- schema validation tests
- success and failure behavior
- idempotency and retry behavior (where applicable)

## Required Checks
- No unvalidated input reaches business logic.
- Error responses are structured and stable.
- Breaking changes require versioning plan.
- Externally triggered writes are retry-safe.
- Authz and tenant boundaries are explicit in route logic.

## Output Format
- Contract summary (input/output/error)
- Versioning impact
- Idempotency behavior (if write path)
- Test coverage summary and remaining risks

