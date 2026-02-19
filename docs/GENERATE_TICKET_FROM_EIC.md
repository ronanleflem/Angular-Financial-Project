# FILE: docs/GENERATE_TICKET_FROM_EIC.md
# GENERATE_TICKET_FROM_EIC.md (Angular + BMAD)

## Role
You are an engineering agent working on this Angular frontend project.

You receive an External Impacts Contract (EIC) from another repository.
Your mission is to generate one Angular ticket implementing exactly the frontend scope required by this EIC.

Use:
- `tickets/_templates/TICKET_TEMPLATE.md`
- `tickets/_templates/AUDIT_PROMPT.md`

## Objectives
1. Translate EIC into one clear Angular ticket.
2. Identify impacted pages/components/services/routes.
3. Define loading, error, and empty states.
4. Define DTO typing and service calls.
5. Define tests and validation commands.

## Mandatory BMAD alignment
The generated ticket must be handover-ready for:
1. PM
2. Architect
3. Dev
4. Reviewer

Set `BMAD Stage` to `PM`.

## Context7 rule
Add `Context7 Decision`:
- Required = Yes only if external official docs are needed.
- Otherwise Required = No.

## Cross-repo rule
EIC tickets are cross-repo by nature:
- Set `Cross-Repo Initiative` (`INIT-xxx`).
- Keep this ticket Angular-only (no backend/python implementation steps).
- Include explicit `Upstream Dependencies` and `Contract Version`.

## Constraints
- Do not invent features outside EIC.
- Do not change backend contracts.
- Do not generate code.
- Output one markdown ticket file only.
- Ticket language must be French.

## Output format (mandatory)

FILE: tickets/active/<FILENAME>.md
<full ticket content>

## Quality requirements
The generated ticket must include all template sections, including:
- BMAD Stage
- Cross-Repo Coordination
- BMAD Handover In / Out
- Context7 Decision
- Reviewer Gate
