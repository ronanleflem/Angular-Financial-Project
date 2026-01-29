# FILE: docs/AI_WORKFLOW.md
# AI Workflow Guide

This project uses AI-friendly tickets to ensure clear scope, testability, and predictable delivery.

## Workflow
1. Audit the ticket using `tickets/_templates/AUDIT_PROMPT.md`.
2. Produce a short plan with numbered steps.
3. Implement step by step, keeping changes small and reviewable.
4. Validate with the listed commands.
5. Mark the ticket as done only when DoD is fully satisfied.

## Angular rules
- Strict typing everywhere (DTOs, interfaces, method signatures).
- Prefer `async` pipe over manual subscriptions.
- Manage subscriptions explicitly when needed (e.g., `takeUntil`).
- Handle loading, empty, and error states in the UI.
- Add tests for services and components when you change them.

## Ticket states
- Active: currently in progress.
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
