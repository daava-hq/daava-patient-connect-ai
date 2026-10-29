---
mode: ask
description: Create a CSS Module for a component using Patient Connect design tokens.
---

# Create a CSS Module

**Before you begin**: Read `docs/ui-and-css-rules.md`.

## Input

Component: **[COMPONENT_NAME]** (e.g., `PatientCard`)
Path: **[PATH]** (e.g., `src/components/feature/Patients/PatientCard/PatientCard.module.css`)

## Steps

1. Create `[PATH]` with a CSS Module file.

2. Use only CSS custom properties from `styles/tokens.css` — no raw hex values, pixel magic numbers, or hardcoded font stacks.

3. Name classes in camelCase (e.g., `.cardHeader`, `.statusBadge`).

4. Include styles for all required component states:
   - Default
   - Hover
   - Focus (visible focus ring: `outline: 2px solid var(--color-primary); outline-offset: 2px`)
   - Disabled (muted colors, `cursor: not-allowed`)
   - Loading (if the component has a loading state)
   - Error (border or text using `--color-error`)
   - Empty (if the component shows an empty state)

5. Use responsive layout with relative units and `min-width` media queries where needed.

6. Import the module in the component file:
   ```tsx
   import styles from './[ComponentName].module.css';
   // Usage: <div className={styles.cardHeader}>
   ```

## Constraints

- No inline styles (except truly dynamic JS-computed values).
- No global class names — all selectors scoped within the CSS Module.
- No `!important`.

## Verification

Visually check all states in `pnpm dev`. Run `pnpm lint` to confirm no CSS lint errors.
