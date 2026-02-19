# FILE: docs/AI_WORKFLOW.md
# AI Workflow Guide

This project uses AI-friendly tickets to ensure clear scope, testability, and predictable delivery.

## Workflow (BMAD)
1. PM stage: clarify goal, scope, non-goals, DoD, and risks.
2. Architect stage: validate technical approach, dependencies, and rollback strategy.
3. Dev stage: implement in small reviewable steps with tests.
4. Reviewer stage: run review gate before merge.
5. Done only if all gates pass and validation commands are green.

## Cross-repo workflow
Use this when a feature spans Angular + other repos (e.g. Spring/Python):
1. Create one initiative in the coordination repo (`INIT-xxx`).
2. Build one context pack referencing source docs from each repo (with commit SHA).
3. Generate one local ticket per repo (no ticket duplication).
4. Link all local tickets to the same `INIT-xxx`.
5. Track dependencies explicitly (`blocked_by`, `unblocks`) at ticket level.

Local ticket ownership rule:
- Angular ticket stays in this repo and contains Angular-only scope.
- Backend/Python tickets stay in their own repos and contain local scope only.

## BMAD command examples
- PM framing (small changes): `{ "operation": "execute", "workflow": "tech-spec", "message": "Prepare implementation-ready technical ticket for <topic>" }`
- PM framing (larger product changes): `{ "operation": "execute", "workflow": "prd", "message": "Prepare PRD for <topic>" }`
- Architecture: `{ "operation": "execute", "workflow": "architecture", "message": "Design architecture for <topic>" }`
- Development: `{ "operation": "execute", "workflow": "dev-story", "message": "Implement ticket <id>" }`
- Review: `{ "operation": "execute", "workflow": "code-review", "message": "Review ticket <id> ready for review" }`

## Stage outputs (handover)
- PM output: implementation-ready ticket with clear DoD and test plan.
- Architect output: approved architecture decisions, risks, and constraints.
- Dev output: code, tests, and validation evidence.
- Reviewer output: findings list, required fixes, or approval.

Cross-repo handover fields expected in tickets:
- `Cross-Repo Initiative`: `INIT-xxx`
- `Upstream Dependencies`: list of external tickets/PRs
- `Contract Version`: explicit API/contract version when relevant

## Context7 policy (required only when necessary)
Use Context7 only when at least one condition is true:
- New library/framework/API not already mastered by the team.
- Version-specific behavior can change implementation details.
- Uncertain or conflicting documentation in local/project docs.
- Architecture decision depends on external official documentation.

Do not use Context7 for:
- Routine Angular patterns already present in the codebase.
- Pure refactors with no dependency/API uncertainty.
- Minor UI-only changes with existing local examples.

## Angular rules
- Strict typing everywhere (DTOs, interfaces, method signatures).
- Prefer `async` pipe over manual subscriptions.
- Manage subscriptions explicitly when needed (e.g., `takeUntil`).
- Handle loading, empty, and error states in the UI.
- Add tests for services and components when you change them.

## Ticket states
- Active: currently in progress.
- Review: waiting for review gate decision.
- Done: validated, tests passing, DoD met.
- Blocked: waiting on missing API, design, or product decision.

## Branch / PR conventions
- Branch name: `feature/<ticket-id>-short-title` or `fix/<ticket-id>-short-title`.
- PR title: `[<ticket-id>] Short summary`.
- PR description: include plan, tests run, and screenshots if UI changed.

## Using templates
- Start from `tickets/_templates/TICKET_TEMPLATE.md`.
- Run `tickets/_templates/AUDIT_PROMPT.md` as a checklist before coding.
- Keep tickets small; split if it exceeds 2-3 days of work.

## Validation
- Always run `ng test` and `ng build` before marking done.
- Add `npx playwright test` when the ticket impacts critical flows.
