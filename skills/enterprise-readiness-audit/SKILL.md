---
name: enterprise-readiness-audit
description: Use this skill when reviewing plans or implementation status for enterprise readiness in this virtual health project. It identifies what is complete, what is missing, and what should be prioritized next across security, compliance, IAM, reliability, operations, and governance.
---

# Enterprise Readiness Audit

## Purpose
Use this skill to run a structured enterprise-gap review against:
- `NEXTJS_SUPABASE_MASTER_BUILD_PLAN.md`
- `AIDLC_IMPLEMENTATION_PLAN_NEXTJS_SUPABASE.md`
- `complete.md`

## When To Use
- The user asks what remains for an enterprise-level launch.
- The user asks for risk/gap review across implementation docs.
- We are preparing stage gates, pilot, or production readiness checks.

## Workflow
1. Read the three project planning files.
2. Score each domain as `Complete`, `Partial`, or `Missing`.
3. Report findings ordered by severity:
- `Critical`: launch blockers
- `High`: major enterprise gaps
- `Medium`: important hardening follow-ups
4. Convert findings into actionable tracker items in `complete.md` with clear owners and status.
5. Recommend the next 3 execution priorities.

## Required Domains
- IAM and access governance (SSO/SCIM, privileged access, lifecycle)
- Security engineering (auditability, secrets, vuln management, pentest)
- Compliance and evidence operations (HIPAA plus target framework mapping)
- Reliability and DR (SLOs, error budgets, backup/restore, incident response)
- Data governance (retention, classification, residency, key strategy)
- Platform governance (change management, release controls, API governance)

## Output Format
- Findings with severity and exact file references.
- Assumptions and open questions.
- Recommended next actions and tracker updates.

