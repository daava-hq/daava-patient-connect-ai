# Patient Connect — UI & CSS Rules

## Brand identity

| Element | Specification |
|---------|--------------|
| Logo mark | Rounded blue square with white "PC" letters |
| Wordmark | "Patient Connect" in brand typeface beside the logo |
| Palette | See design tokens below |
| Mode | Light-only (no dark mode in MVP) |

## Design tokens (`styles/tokens.css`)

All tokens are CSS custom properties. Feature CSS Modules reference them — never use raw hex values in component styles.

```css
:root {
  /* Colour */
  --color-surface:         #ffffff;
  --color-background:      #f0f4f8;   /* light blue-gray */
  --color-primary:         #2563eb;   /* blue — primary actions */
  --color-primary-hover:   #1d4ed8;
  --color-primary-active:  #1e40af;
  --color-text:            #1e3a5f;   /* navy */
  --color-text-muted:      #64748b;
  --color-border:          #cbd5e1;
  --color-error:           #dc2626;
  --color-success:         #16a34a;
  --color-warning:         #d97706;

  /* Typography */
  --font-sans:    system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;

  /* Spacing (4-point grid) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.07);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.07);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
}
```

## CSS rules

1. **Design tokens only** — never use raw hex, pixel magic numbers or arbitrary Tailwind-style values.
2. **CSS Modules** for every component: one `Name.module.css` per `Name.tsx`.
3. **camelCase class names** inside CSS Modules (`cardHeader`, not `card-header`).
4. **`globals.css`** for resets, body, focus ring, html/body box-sizing only.
5. **No inline styles** except where value is truly dynamic (e.g., chart widths from JS).
6. **No duplicate styles** — extract shared patterns into reusable components.
7. **Responsive by default**: use fluid layouts, `min-width` media queries, and relative units.

## Component requirements

Every interactive component must implement:

| State | Requirement |
|-------|------------|
| Loading | Skeleton or spinner |
| Empty | Friendly empty-state message |
| Error | Visible error with actionable message |
| Success | Confirmation feedback |
| Disabled | `aria-disabled` + muted visual |
| Focus | Visible focus ring using `--color-primary` outline |
| Hover | Distinct hover background or border change |

## Accessibility

- WCAG AA contrast minimum (4.5:1 for text, 3:1 for UI elements).
- All interactive elements keyboard-reachable and operable.
- Use semantic HTML (`button`, `nav`, `main`, `article`, `section`, `label`, `h1–h6`).
- `aria-label` or visible label on every form control.
- Focus trap in modals; restore focus on close.

## Workspace shell

The authenticated layout includes:

- **Header**: Logo + wordmark, practice selector (dropdown), global search, user profile menu.
- **Sidebar**: Module navigation links with active state and icons.
- **Content area**: Route-specific page content with consistent page heading.

Both header and sidebar are Server Components unless user interaction is required.

## Logo usage

```tsx
// Always use the shared Logo component — never inline SVG in pages
import Logo from '@/components/ui/Logo/Logo';

<Logo size="md" />
```

The Logo component renders the rounded blue square with white "PC" letters and the Patient Connect wordmark.
