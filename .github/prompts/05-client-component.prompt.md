---
mode: ask
description: Create a React Client Component with interactivity.
---

# Create a Client Component

**Before you begin**: Read `docs/ui-and-css-rules.md` and `.github/instructions/frontend.instructions.md`.

## Input

Component name: **[COMPONENT_NAME]** (PascalCase, e.g., `PatientSearchBar`)
Location: **[PATH]** (e.g., `src/components/feature/Patients/PatientSearchBar/`)

## Steps

1. Add `"use client"` as the very first line.
2. Create `[ComponentName].tsx` with clear prop types defined via `interface`.
3. Create `[ComponentName].module.css` — use design tokens exclusively.
4. Use `useState` / `useReducer` for local state; `useEffect` only for side effects.
5. For data fetching triggered by user interaction, call the app's API routes (`/api/...`) via `fetch`.
6. Handle loading, error and empty states visually within the component.
7. Implement keyboard navigation and ARIA attributes where required.
8. Create `[ComponentName].test.tsx` with at least: render test, user interaction test, and error state test.

## Constraints

- Never import from `src/db/` or `src/lib/auth/` — those are server-only.
- Never read `process.env` (except `NEXT_PUBLIC_*` variables).
- Props must be typed; `children` typed as `React.ReactNode` when needed.

## Verification

Run `pnpm test [ComponentName]` and confirm all tests pass.  
Check keyboard navigation manually in `pnpm dev`.
