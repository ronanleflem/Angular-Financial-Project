# FILE: tickets/_templates/AUDIT_PROMPT.md
# Ticket Audit Prompt (Angular + BMAD)

Use this checklist to review a ticket before implementation.

## PM gate
- [ ] Goal is clear, measurable, and user-visible.
- [ ] Scope and non-goals are explicit.
- [ ] DoD is testable.

## Architect gate
- [ ] Impacted modules/components/services are identified.
- [ ] Technical approach is coherent with existing architecture.
- [ ] Risks and rollback strategy are documented.

## Dev gate
- [ ] Task can be split into small reviewable steps.
- [ ] Data states are covered (loading/error/empty).
- [ ] Tests and validation commands are defined.

## Reviewer gate
- [ ] Review criteria are explicit and blocking.
- [ ] Regression risks are identified.
- [ ] Acceptance can be decided from evidence.

## Cross-repo gate (if applicable)
- [ ] `Cross-Repo Initiative` is set (`INIT-xxx`).
- [ ] External dependencies are explicit (`Depends on` / `Upstream Dependencies`).
- [ ] Contract/version reference is explicit and testable.
- [ ] Scope remains local to Angular repo (no foreign implementation scope).

## Angular conventions
- [ ] Follows Angular style guide and project conventions.
- [ ] Uses strict typing for DTOs and interfaces.
- [ ] RxJS usage is safe (no nested subscribes, proper teardown).

## Context7 check (required only if needed)
- [ ] New or uncertain external API/library/framework involved.
- [ ] Version-specific behavior may affect implementation.
- [ ] If no, Context7 is intentionally skipped.

## Non-goals / Guardrails
- [ ] No global refactors unless explicitly requested.
- [ ] No unrelated style or layout changes.
- [ ] No API contract changes without backend agreement.
- [ ] No changes to shared theming/design system unless requested.
