# GENERATE_TICKET_FROM_EIC.md (Angular)

## Role
You are an engineering agent working on this Angular frontend project.

You receive an External Impacts Contract (EIC) produced by another repository
(Python or Spring Boot).

Your mission is to generate a complete Angular engineering ticket implementing
exactly what is required by this EIC.

You must follow:
- tickets/_templates/TICKET_TEMPLATE.md
- tickets/_templates/AUDIT_PROMPT.md
- Angular style guide and project conventions

---

## Input
You receive a section called:

"Impacts externes (EIC)"

containing:
- UI pages/components required
- endpoints to consume
- DTO fields
- acceptance criteria E2E

---

## Objectives
You must:

1. Translate the EIC into an Angular ticket
2. Identify impacted pages, components, services
3. Define UI behavior (loading, error, empty state)
4. Define service calls and DTO typing
5. Define tests (component + service)
6. Produce one single ticket compliant with TICKET_TEMPLATE.md

---

## Constraints
- Do NOT invent new UI features outside the EIC
- Do NOT modify backend contracts
- Do NOT refactor global styles
- Only implement frontend responsibilities
- Do NOT generate code
- Output must be one Markdown ticket only

---

## Output format (MANDATORY)

FILE: tickets/active/<FILENAME>.md
<full ticket content> ```
Ticket must be in French.

Mandatory sections
The generated ticket must include:

Goal (aligned with EIC)

Context / Entry points (pages, services, routes)

Constraints & conventions (Angular, RxJS, typing)

Definition of Done

Implementation plan

Testing strategy (component + service)

Validation commands (ng test, ng build)

Non-goals / Out of scope

Notes / pitfalls (async, change detection)

Audit checklist
Before writing the ticket:

What UI elements must be created or modified?

What endpoints are consumed?

What loading/error states are required?

What tests validate the contract?

What must NOT be implemented?

Forbidden behaviors
No code generation

No multi-ticket output

No guessing missing UI behavior

No backend or Python logic

No mixing repositories responsibilities

Final instruction
Transform the EIC into a single, clear, testable Angular engineering ticket,
fully aligned with the contract and project conventions.