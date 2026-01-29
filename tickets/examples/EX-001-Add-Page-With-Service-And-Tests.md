# FILE: tickets/examples/EX-001-Add-Page-With-Service-And-Tests.md
# EX-001 - Add Page With Service and Tests

## Title
Add a new data availability page that fetches availability metrics from the API and displays loading/error/data states.

## Goal
Provide users a dedicated page to view availability metrics for the last 30 days with clear loading and error handling.

## Context / Entry points
- Pages/components: `DataAvailabilityPage` (new), `AvailabilityTableComponent` (new)
- Services: `AvailabilityService` (new)
- State (if any): local component state only
- Routes: add `/availability` route under the main app router
- API endpoints: `GET /api/availability?range=30d`
- Related docs: `ARCHITECTURE_MAP.md`, `PROJECT_OVERVIEW.md`

## Constraints & conventions
- Use Angular standalone components if the project does so; otherwise follow current module pattern.
- Use strict typing with DTOs: `AvailabilityResponse`, `AvailabilityRow`.
- Use RxJS `Observable` with `async` pipe in templates.
- No nested `subscribe`; use `switchMap` or `map` as needed.
- Follow existing naming and folder structure for pages/services.

## Definition of Done
- [ ] New page reachable at `/availability`.
- [ ] Shows loading spinner while fetching.
- [ ] Shows friendly error panel on API failure.
- [ ] Shows table once data loads.
- [ ] Unit tests for service and page component.
- [ ] `ng test` and `ng build` pass.

## Implementation plan
1. Create the `AvailabilityService` with a typed `getAvailability(range: string)` method.
2. Add DTO interfaces for the API response.
3. Create the `DataAvailabilityPage` with `loading`, `error`, and `data` states.
4. Add `AvailabilityTableComponent` to render data.
5. Add route to the main router.
6. Write unit tests for service and page component.

## Tests
- Service tests:
  - Should call `GET /api/availability?range=30d`.
  - Should map response to `AvailabilityResponse`.
- Component tests:
  - Should render loading state before data arrives.
  - Should render error state on API error.
  - Should render table when data is available.
- E2E tests (optional):
  - Navigate to `/availability` and verify table renders.

## Validation commands
- `ng test`
- `ng build`
- (Optional) `npx playwright test`

## Non-goals / Out of scope
- Changing backend API contract.
- Adding global UI theme changes.
- Adding advanced filters beyond the 30-day default.

## Notes / pitfalls
- Ensure change detection works with `async` pipe.
- Avoid memory leaks by not manually subscribing in components.
- Handle HTTP errors via `catchError` and surface a user-friendly message.
