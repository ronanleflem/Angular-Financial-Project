# FILE: tickets/_templates/AUDIT_PROMPT.md
# Ticket Audit Prompt (Angular)

Use this checklist to review a ticket before implementation.

## UX / Goal clarity
- [ ] User outcome is clear and testable.
- [ ] Success criteria are observable in the UI.

## Scope and entry points
- [ ] Affected pages/components are listed.
- [ ] Services and API endpoints are listed.
- [ ] Routing/state impact is described.

## Angular conventions
- [ ] Follows Angular style guide and existing project conventions.
- [ ] Uses strict typing for DTOs and interfaces.
- [ ] RxJS usage is safe (no nested subscribes, proper teardown).

## Data states
- [ ] Loading state defined.
- [ ] Error state defined.
- [ ] Empty state defined (if applicable).

## Tests and validation
- [ ] Service unit tests included.
- [ ] Component unit tests included.
- [ ] E2E tests required/optional are stated.
- [ ] Validation commands listed (`ng test`, `ng build`, etc.).

## Risks
- [ ] Potential breaking UI changes identified.
- [ ] Performance concerns identified.
- [ ] RxJS memory leak risk assessed.

## Task breakdown
- [ ] Ticket can be split into small, parallelizable steps.

## Non-goals / Guardrails
- [ ] No global refactors unless explicitly requested.
- [ ] No unrelated style or layout changes.
- [ ] No API contract changes without backend agreement.
- [ ] No changes to shared theming/design system.
