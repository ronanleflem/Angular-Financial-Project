# FILE: tickets/_templates/TICKET_TEMPLATE.md
# Ticket Template

## Title
- [Short, actionable title]

## Goal
- [User-visible outcome or measurable result]

## Context / Entry points
- Pages/components:
- Services:
- State (if any):
- Routes:
- API endpoints:
- Related docs:

## Constraints & conventions
- Follow Angular style guide and existing project patterns.
- Use strict typing (DTOs, interfaces, explicit types).
- Use RxJS best practices (no nested subscribes, manage subscriptions).
- Keep naming consistent with the feature and file structure.
- Avoid breaking existing UI/UX and routing.

## Definition of Done
- [ ] Feature works end-to-end in the UI.
- [ ] Loading, empty, and error states handled.
- [ ] Service, component tests added/updated.
- [ ] No TypeScript errors; lint and build pass.
- [ ] Ticket scope respected (no unrelated refactors).

## Implementation plan
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Tests
- Service tests:
- Component tests:
- E2E tests (if applicable):

## Validation commands
- `ng test`
- `ng build`
- (Optional) `npx playwright test`

## Non-goals / Out of scope
- [Explicitly list what is not included]

## Notes / pitfalls
- Change detection considerations:
- Async/error handling:
- Performance or RxJS leaks:
