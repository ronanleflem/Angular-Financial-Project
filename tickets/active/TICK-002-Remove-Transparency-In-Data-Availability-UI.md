# Ticket Template

## Title
- Remove transparency from UI boxes in data-availability (global where applicable)

## Goal
- Ensure the data-availability section has no transparent boxes or overlays, using solid backgrounds consistently. Avoid data-availability-specific hacks; prefer shared/global styles where possible.

## Context / Entry points
- Pages/components: `DataAvailabilityPageComponent` and its sub-components in `src/app/pages/data-availability/...`
- Services: none directly
- State (if any): none
- Routes: `/data-availability`
- Related docs: `PROJECT_OVERVIEW.md`

## Constraints & conventions
- Follow Angular style guide and existing project styling patterns.
- Prefer shared/global styles over data-availability-specific overrides.
- Avoid breaking existing UI elsewhere; scope changes carefully.
- No refactor of unrelated CSS or design system.

## Definition of Done
- [ ] No transparency remains on data-availability boxes/cards/containers.
- [ ] Solid backgrounds applied consistently (no rgba/alpha, no transparent overlays).
- [ ] No data-availability-specific hack; solution is reusable or global.
- [ ] Visual regression checked on data-availability page.
- [ ] `ng build` and `ng test` pass.

## Implementation plan
1. Audit data-availability templates and styles for transparency (rgba/opacity/backdrop-filter).
2. Identify shared classes/selectors that control box/card backgrounds (e.g. `mat-*` container styles).
3. Propose a global style override (or shared class) to enforce solid backgrounds.
4. Apply changes and verify no unintended impact on other pages.
5. Update/adjust component styles if needed to align with global changes.

## Tests
- Component tests: ensure data-availability components render and no style-related failures occur.
- Visual check (manual): verify backgrounds are solid and readable.

## Validation commands
- `ng test`
- `ng build`

## Non-goals / Out of scope
- Reworking layout or spacing.
- Changing component structure or logic.
- Redesigning UI beyond transparency removal.

## Notes / pitfalls
- Be careful with `opacity` on parent containers; it affects child text.
- Avoid `backdrop-filter` overlays that imply transparency.
- If using global CSS, scope narrowly to prevent unintended style regressions.
