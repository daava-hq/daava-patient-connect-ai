# Patient Connect — GitHub Workflow

## Branch strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code. Protected. |
| `develop` | Integration branch. All PRs target here first. |
| `feature/<slug>` | New feature work. Branches off `develop`. |
| `fix/<slug>` | Bug fixes. Branches off `develop` (or `main` for hotfixes). |
| `chore/<slug>` | Non-functional changes (deps, tooling, docs). |
| `milestone/<n>` | Milestone integration branch when coordinating multiple features. |

Never force-push or rewrite history on `main` or `develop` without explicit team authorization.

## Commit conventions (Conventional Commits)

```
<type>(<scope>): <short summary>

[optional body]

[optional footers]
```

### Types

| Type | When |
|------|------|
| `feat` | New feature or user-visible behaviour |
| `fix` | Bug fix |
| `chore` | Build, deps, tooling, config |
| `docs` | Documentation only |
| `refactor` | Code restructure without behaviour change |
| `test` | Add or fix tests |
| `style` | CSS / formatting; no logic change |
| `perf` | Performance improvement |
| `ci` | CI/CD pipeline changes |

### Scope examples

`auth`, `patients`, `appointments`, `reminders`, `connect`, `db`, `jobs`, `opendental`, `reports`, `settings`

### Examples

```
feat(appointments): add calendar view with Open Dental sync
fix(auth): redirect unauthenticated users to /login
chore(deps): upgrade drizzle-orm to 0.30
docs(roadmap): mark milestone 1 complete
```

## Pull request rules

- Every PR must target `develop` (or the relevant milestone branch).
- PR description must include: summary, affected modules, testing notes.
- Require at least one approving review.
- All lint, type-check and test checks must pass before merge.
- Squash merge preferred to keep `develop` history clean.
- Link related issue with `Closes #<n>` in the PR description.

## What never goes into a commit

- Secrets, API keys, credentials, `.env` files.
- Patient data exports, database dumps.
- Sensitive logs or PII.

## CI checks (to be wired in a later milestone)

1. `pnpm lint` — ESLint.
2. `pnpm typecheck` — `tsc --noEmit`.
3. `pnpm test` — Vitest unit + integration.
4. `pnpm build` — Next.js production build.
5. Playwright e2e (on staging environment).
