---
applyTo: "src/app/**,src/components/**"
---

# Frontend — Copilot instructions

## React & Next.js

- Use **Server Components** by default; add `"use client"` only when state, effects or browser APIs are required.
- Never fetch data or access the database in Client Components.
- Co-locate `loading.tsx` and `error.tsx` with every route segment.
- Use `<Suspense>` boundaries around async Server Components.

## TypeScript

- Strict mode is enabled; no `any`, no `as unknown as X` unless truly unavoidable.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- Export shared types from `src/types/`.

## Component structure

```
ComponentName/
  ComponentName.tsx        ← component + export
  ComponentName.module.css ← styles
  ComponentName.test.tsx   ← unit tests (if testable in isolation)
```

- One default export per file.
- No business logic in components — call server actions or API routes.
- Validate props with TypeScript; do not use `PropTypes`.

## CSS

- Import from `ComponentName.module.css`; use camelCase class names.
- Reference design tokens from `styles/tokens.css` only — no hardcoded colors or spacing.
- Every component must handle: loading, empty, error, success and disabled states.
- Provide accessible focus rings (`outline: 2px solid var(--color-primary)`).

## Accessibility

- Semantic HTML only (`button`, `nav`, `main`, `h1–h6`, `label`).
- `aria-label` on every control that lacks visible text.
- Focus trap in modals; restore focus on close.
- WCAG AA contrast minimum.

## Prohibited in frontend files

- No `process.env` secrets.
- No database imports.
- No direct Open Dental API calls.
- No hardcoded `practice_id` or user IDs.
