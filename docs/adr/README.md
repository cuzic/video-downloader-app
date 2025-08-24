# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) that document significant architectural decisions made in the Video Downloader project.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision made along with its context and consequences. ADRs help future developers understand why certain decisions were made.

## ADR Format

Each ADR follows this format:
- **Title**: ADR-NNN: Brief description
- **Status**: Proposed/Accepted/Deprecated/Superseded
- **Context**: The issue motivating this decision
- **Decision**: The change that we're proposing/accepting
- **Consequences**: What becomes easier or harder because of this decision

## Current ADRs

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](001-use-bun-as-runtime.md) | Use Bun as Primary Runtime and Package Manager | Accepted | 2024-08 |
| [002](002-electron-architecture.md) | Electron Process Architecture | Accepted | 2024-08 |
| [003](003-database-choice.md) | Use SQLite with Drizzle ORM | Accepted | 2024-08 |
| [004](004-testing-strategy.md) | Dual Test Runner Strategy (Bun and Vitest) | Accepted | 2024-08 |

## Creating a New ADR

1. Copy the template below
2. Name the file `NNN-brief-description.md` where NNN is the next number
3. Fill in all sections
4. Submit as part of your PR

### Template

```markdown
# ADR-NNN: [Title]

## Status
[Proposed/Accepted/Deprecated/Superseded]

## Context
[Describe the context and problem]

## Decision
[Describe the decision and rationale]

## Consequences

### Positive
- [Positive consequence 1]
- [Positive consequence 2]

### Negative
- [Negative consequence 1]
- [Negative consequence 2]

### Neutral
- [Neutral consequence 1]
- [Neutral consequence 2]

## Implementation Notes
[Any additional implementation details]
```

## Why ADRs Matter

- **Knowledge Preservation**: Captures the "why" behind decisions
- **Onboarding**: Helps new team members understand the architecture
- **Decision History**: Tracks how the architecture evolved
- **Avoid Repetition**: Prevents revisiting the same discussions
- **Accountability**: Clear record of who made decisions and when