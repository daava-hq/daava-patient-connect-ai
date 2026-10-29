---
mode: ask
description: Create a Next.js Server Component page with loading and error states.
---

# Create a Server Component page

**Before you begin**: Read `docs/folder-structure.md`, `docs/ui-and-css-rules.md`, and `.github/instructions/frontend.instructions.md`.

## Input

Page: **[PAGE_NAME]** (e.g., "Patients list")
Route path: **[ROUTE]** (e.g., `src/app/(workspace)/patients/page.tsx`)

## Steps

1. Create `[ROUTE]/page.tsx` as an `async` Server Component.
2. Call `getServerSession` at the top; redirect to `/login` if missing.
3. Verify practice membership before fetching data.
4. Fetch data via the repository layer (not directly via fetch in the component).
5. Create `[ROUTE]/loading.tsx` with a skeleton or spinner that matches the page layout.
6. Create `[ROUTE]/error.tsx` as a Client Component with `"use client"` and an error boundary.
7. Implement the UI using shared components from `src/components/`.
8. Create a CSS Module `[ComponentName].module.css` using design tokens only.
9. Include empty state (no data matching filters) with a helpful message.

## Constraints

- No `useEffect`, `useState`, or event handlers in this file — it is a Server Component.
- Data fetching must be server-side; never call internal API routes from Server Components.
- Page heading must use `<h1>` with navy text (`var(--color-text)`).

## Verification

Run `pnpm typecheck` and confirm the page renders in `pnpm dev` with no console errors.
