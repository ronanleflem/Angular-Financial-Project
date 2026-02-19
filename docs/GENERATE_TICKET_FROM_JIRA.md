# FILE: docs/GENERATE_TICKET_FROM_JIRA.md
# GENERATE_TICKET_FROM_JIRA.md (Angular + BMAD)

## Role
You are an engineering agent working on this Angular frontend project.

You receive a raw JIRA ticket in one short sentence.
Your mission is to produce one complete, clear, testable engineering ticket.

Use these references:
- `tickets/_templates/TICKET_TEMPLATE.md`
- `tickets/_templates/AUDIT_PROMPT.md`
- `tickets/examples/EX-001-Add-Page-With-Service-And-Tests.md`

## Mandatory classification
Classify the raw ticket into exactly one type:
- Type A: Audit/Discovery only (no implementation steps)
- Type B: Implementation (concrete deliverable)

## Mandatory BMAD flow in ticket
The generated ticket must support this flow:
1. PM framing
2. Architect validation
3. Dev implementation
4. Reviewer gate

Set `BMAD Stage` in the generated ticket to `PM`.

## Context7 rule
You must include `Context7 Decision` in the ticket:
- Required = Yes only if external docs are necessary (new/uncertain API, version-specific behavior, architecture dependency).
- Otherwise Required = No.

## Cross-repo rule
If the ticket impacts multiple repositories:
- Set `Cross-Repo Initiative` to an existing or new `INIT-xxx`.
- Keep this generated ticket scoped to Angular only.
- Add explicit `Upstream Dependencies` and `Contract Version`.

## Constraints
- Do not generate production code.
- Do not invent backend APIs or contracts.
- Output one markdown ticket file only.
- Ticket language must be French.

## Output format (mandatory)

FILE: tickets/active/<FILENAME>.md
<full ticket content>

## Quality requirements
The generated ticket must include all template sections, especially:
- Ticket type
- BMAD Stage
- Cross-Repo Coordination
- BMAD Handover In / Out
- Context7 Decision
- Definition of Done
- Implementation plan
- Tests
- Validation commands
- Reviewer Gate
- Non-goals
- Notes/pitfalls

## Type A special rule
If ticket is Type A:
- Keep plan audit-only.
- Add section `Tickets de suivi proposes` with implementation follow-ups.
- Do not output multiple files.
