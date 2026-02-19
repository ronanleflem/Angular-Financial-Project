# FILE: docs/CROSS_REPO_COORDINATION.md
# Cross-Repo Coordination Guide

This document defines how Angular work is coordinated with other repositories.

## Goals
- Keep execution local to each repo.
- Keep cross-repo visibility centralized.
- Avoid duplicated ticket content.

## Canonical setup
- Coordination repo (tracking only): `C:\Users\ronan\Desktop\Cross-repo-coordination\Cross-repo-coordination`
- Angular execution tickets: `tickets/active/*.md` in this repo
- Backend/Python execution tickets: in their respective repos

## Required objects
1. One initiative file (`INIT-xxx`) in the coordination repo.
2. One context pack file linked to that initiative.
3. One local ticket per impacted repo.

## Ticket linking contract
Each local ticket must include:
- `Cross-Repo Initiative`: `INIT-xxx`
- `Repo Owner`: e.g. `angular-front-financial`
- `Depends on`: list of external ticket ids (if any)
- `Contract Version`: version/tag/commit of shared contract when relevant

## Recommended dependency order
1. Contract/source system updates (Python/Spring as needed)
2. Consumer adaptation (Angular)
3. Cross-repo review and closure

## Completion rule
An initiative is complete only when:
- all linked local tickets are done,
- all required PRs are merged,
- contract/version references are aligned across repos.
