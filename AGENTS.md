# Patient Connect — Agent & Copilot Guide

## Repository snapshot

| Item | Value |
|------|-------|
| Product | Patient Connect — multi-organisation dental practice patient engagement |
| Framework | Next.js 14+ App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Drizzle ORM |
| Package manager | pnpm |
| Styling | CSS Modules + centralized design tokens |
| Testing | Vitest · React Testing Library · Playwright |

## Before every task

1. Read `.github/copilot-instructions.md`.
2. Read the doc relevant to the task (see **Docs index** below).
3. Run `git status` to understand uncommitted state.
4. Never overwrite uncommitted work.

## Docs index

| File | Purpose |
|------|---------|
| `docs/overview.md` | Product scope, modules, architecture |
| `docs/roadmap.md` | Six-week milestone plan with acceptance criteria |
| `docs/folder-structure.md` | Full source tree conventions |
| `docs/database-schema.md` | Tables, relations, migration rules |
| `docs/opendental-integration.md` | Open Dental API sync details |
| `docs/security.md` | Auth, tenant isolation, privacy |
| `docs/ui-and-css-rules.md` | Design tokens, branding, component rules |
| `docs/development-workflow.md` | Local dev, lint, test, build commands |
| `docs/github-workflow.md` | Branch strategy, conventional commits, PR rules |

## Scoped instruction files

Loaded automatically by VS Code Copilot when working in matching paths:

| File | Applies to |
|------|------------|
| `.github/instructions/frontend.instructions.md` | `src/app/**`, `src/components/**` |
| `.github/instructions/api.instructions.md` | `src/app/api/**` |
| `.github/instructions/database.instructions.md` | `src/db/**` |
| `.github/instructions/testing.instructions.md` | `**/*.test.ts`, `**/*.test.tsx`, `e2e/**` |
| `.github/instructions/integration.instructions.md` | `src/lib/opendental/**`, `src/jobs/**` |
| `.github/instructions/security.instructions.md` | `src/lib/auth/**`, `src/middleware.ts` |

## Prompt files (manual invocation)

| File | When to use |
|------|-------------|
| `.github/prompts/01-scaffold-feature.prompt.md` | Scaffold a new feature module |
| `.github/prompts/02-add-db-table.prompt.md` | Create a new Drizzle table + migration |
| `.github/prompts/03-api-route.prompt.md` | Add a validated API route handler |
| `.github/prompts/04-server-component.prompt.md` | Create a Server Component page |
| `.github/prompts/05-client-component.prompt.md` | Create a Client Component |
| `.github/prompts/06-opendental-sync.prompt.md` | Implement an Open Dental sync job |
| `.github/prompts/07-auth-guard.prompt.md` | Add auth + practice isolation guard |
| `.github/prompts/08-css-module.prompt.md` | Create a CSS Module for a component |
| `.github/prompts/09-unit-test.prompt.md` | Write Vitest unit tests |
| `.github/prompts/10-e2e-test.prompt.md` | Write a Playwright e2e test |
| `.github/prompts/11-migration.prompt.md` | Write a Drizzle migration |
| `.github/prompts/12-background-job.prompt.md` | Create a durable background job |
| `.github/prompts/13-security-review.prompt.md` | Run a security review on a feature |

## Definition of done

A feature is complete only when:
- UI, server logic, validation, authorization, persistence are implemented.
- Loading, empty, error, success and disabled states are present.
- Lint, type-check and targeted tests pass.
- Documentation and roadmap are updated.
