# FILE: docs/AI_WORKFLOW.md
# AI Workflow Guide (Angular local execution)

This file defines local execution rules for Angular only.

Global orchestration is managed in:
`C:\Users\ronan\Desktop\Cross-repo-coordination\Cross-repo-coordination`

## Local scope rules
- Keep scope local to Angular repository.
- Do not orchestrate Spring or Python from this file.
- Follow local ticket template and audit prompt.

## Local BMAD sequence
1. PM
2. Architect
3. Dev
4. Reviewer

## Context7
Use only when external docs are required.

## Validation
- `ng test`
- `ng build`
- optional: `npx playwright test`
