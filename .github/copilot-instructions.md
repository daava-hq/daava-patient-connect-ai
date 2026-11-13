# Patient Connect — Repository Instructions

## Product

Patient Connect is a multi-organization dental practice patient engagement platform.

Modules:
- Login and user profile.
- Organization and practice selection.
- Dashboard.
- Patients synchronized from Open Dental.
- Appointments synchronized from Open Dental.
- Appointment Reminders.
- Birthdays.
- Groups.
- Newsletters.
- Payment Reminders & Requests.
- Recall.
- Referrals.
- Surveys.
- Connect two-way texting.
- Reports for all features.
- Practice settings, branding and team management.

## Technology

Use:
- Next.js App Router.
- React and strict TypeScript.
- PostgreSQL.
- Drizzle ORM and Drizzle Kit.
- pnpm.
- CSS Modules.
- Centralized CSS design tokens.
- Server-side API integrations.
- Durable background jobs.
- Vitest, React Testing Library and Playwright.

Preserve existing compatible dependencies. Inspect the repository before installing packages or changing framework versions.

## Model-independent working rules

These instructions apply regardless of the model selected in Copilot Chat.

1. Do not assume model-specific capabilities.
2. Inspect the repository and relevant files before making changes.
3. Read this file and the relevant docs before every substantial task.
4. Identify the task scope, acceptance criteria, dependencies and risks.
5. Implement only the requested milestone.
6. Make small, coherent changes rather than generating the entire application at once.
7. Do not recreate files that already contain valid implementation.
8. Preserve unrelated changes and inspect git status.
9. Do not silently skip failed commands or tests.
10. Never claim an operation succeeded unless the result was verified.
11. If a tool, API, model capability or environment is unavailable, explain the limitation and provide a safe next step.
12. If context is insufficient, inspect source files and documentation rather than guessing.
13. If the task exceeds the available context, divide it into explicit sub-tasks and preserve progress in the roadmap.
14. If a task affects security, database migrations or external integrations, explain the risk before destructive or irreversible actions.
15. Ask for clarification only when a missing decision materially blocks safe implementation.

## Model switching and handoff

The selected model may change between tasks.

Never rely on an earlier model's hidden reasoning or unrecorded decisions.

Persist important decisions in:
- docs/overview.md
- docs/database-schema.md
- docs/opendental-integration.md
- docs/security.md
- docs/roadmap.md

At the end of each milestone, update the task checklist and report:
- Completed work.
- Files changed.
- Architecture or schema decisions.
- Commands executed and actual results.
- Remaining failures and blockers.
- Exact next task.

A new model must be able to continue by reading repository files alone.

## Branding and UI

Brand: Patient Connect.

Logo:
- Rounded blue square with white PC letters.
- Patient Connect wordmark beside the logo.

Use a polished, responsive, light-only interface with:
- White surfaces.
- Light blue-gray backgrounds.
- Navy text.
- Blue primary actions.
- Consistent spacing, typography and component states.

The authenticated workspace includes a practice-aware header, sidebar, global search and user profile dropdown.

## Naming and file organization

- Components: PascalCase filenames.
- CSS Modules: ComponentName.module.css.
- CSS class names: camelCase.
- Hooks: use-prefixed camelCase.
- Services and repositories: descriptive filenames.
- Types and interfaces: PascalCase.
- Database naming: consistent snake_case.
- Route handlers: Next.js route.ts conventions.
- Tests: *.test.ts or *.test.tsx.

Separate components, pages, CSS Modules, validation, domain services, repositories, database schemas, integration clients, background jobs and tests.

Do not put an entire feature in one file.

## CSS and UI architecture

### Styling rules

- Use CSS Modules (`*.module.css`) for all component- and page-specific styling.
- Import styles with `import styles from './ComponentName.module.css'` and apply them through `className`.
- Do not use React inline styles (`style={{ ... }}`), style objects, or the HTML `style` attribute for application UI.
- Do not use JavaScript to generate CSS strings or inject component styles.
- For genuinely dynamic visual values, prefer CSS custom properties set through a documented, narrowly scoped mechanism; do not use this as a workaround for ordinary styling.
- Keep design tokens in `styles/tokens.css` and global resets, typography defaults and base element styles in `styles/globals.css`.
- Keep global styles minimal. Do not add feature-specific selectors or page layouts to global stylesheets.
- Use CSS class names in camelCase and descriptive names that reflect the component's purpose.
- Avoid arbitrary color values, duplicated declarations, overly specific selectors, `!important`, and unnecessary CSS overrides.
- Do not add a styling framework or dependency without first checking the existing project setup and explaining why it is needed.

### Shared design system

- Inspect the existing shared component library before creating or changing UI components.
- Reuse shared components for buttons, inputs, selects, textareas, cards, tables, pagination, dialogs, tabs, badges, alerts, dropdowns, tooltips and loading indicators.
- If a reusable component is missing and the pattern is used in multiple places, create it in the established shared-components location rather than duplicating markup and styles.
- Keep shared component APIs typed, accessible and consistent. Avoid feature-specific behavior in generic components.
- Centralize reusable design tokens for colors, typography, spacing, sizing, borders, radii, shadows, layering and breakpoints.
- Do not introduce a second design system or duplicate existing tokens/components.

### Component and page structure

- Keep each page and substantial UI component focused; move reusable UI into components and keep its styles in the corresponding CSS Module.
- Do not place an entire feature's UI in one large page or component file.
- Separate presentation from data fetching, business logic and API interaction.
- Prefer existing shared layout, form and table components over bespoke implementations.
- Use semantic HTML and accessible labels, descriptions and error associations.
- Provide visible keyboard focus, logical tab order, accessible contrast and appropriate ARIA attributes only when semantic HTML is insufficient.
- Support responsive desktop, tablet and mobile layouts. Handle narrow screens intentionally rather than relying on horizontal overflow.
- Include consistent loading, empty, error, success, disabled and validation states.
- Ensure hover, focus, active, selected and disabled states are visually consistent.

### UI refactoring and review

When modifying an existing module or page:

1. Inspect the page, its child components, existing CSS, shared components and relevant design tokens before editing.
2. Identify inline styles, duplicated styling, untyped props, and inconsistent UI patterns in the requested scope.
3. Reuse or improve existing shared components before introducing new ones.
4. Move component-specific styling into CSS Modules and remove the corresponding inline styles.
5. Preserve existing functionality, API contracts, data flows and business rules unless the task explicitly requests a behavior change.
6. Check responsive behavior and accessibility for the changed screens.
7. Remove unused styles and imports introduced by the refactor.
8. Run the relevant lint, type-check, tests and build scripts, and report their actual results.

For a task explicitly requesting a UI/CSS refactor, apply these rules to every module included in the requested scope. Do not silently expand the scope to unrelated modules.

### CSS/UI acceptance criteria

- No `style={{ ... }}` or HTML `style` attributes remain in the refactored application UI scope.
- Component- and page-specific styles are in CSS Modules.
- Global CSS contains only shared foundations and genuinely global rules.
- Existing shared components and design tokens are reused consistently.
- No unnecessary duplicate component libraries or styling dependencies are introduced.
- Changed screens are responsive and keyboard accessible.
- Existing behavior is preserved and relevant verification commands pass.

## Server and database

- Use Server Components by default.
- Use Client Components only where interaction requires them.
- Keep database access and secrets server-side.
- Validate untrusted inputs.
- Use typed errors.
- Use Drizzle migrations for schema changes.
- Enforce authorization on every protected server operation.
- Verify organization and practice membership on the server.
- Never trust a client-supplied practice ID without authorization.
- Use transactions and idempotency where required.

## Open Dental

Official documentation:
- https://www.opendental.com/site/apisetup.html
- https://www.opendental.com/site/apipatients.html
- https://www.opendental.com/site/apiappointments.html
- https://www.opendental.com/site/apispecification.html
- https://www.opendental.com/site/apiimplementation.html

Base URL:
https://api.opendental.com/api/v1

Authorization:
Authorization: ODFHIR {DeveloperKey}/{CustomerKey}

Never hardcode or commit credentials. Use practice-specific secure credential storage. Never expose keys to browser code.

Verify endpoint parameters, pagination, timestamps, permissions and response schemas against the current official documentation.

Use bounded retries, throttling handling, durable checkpoints and idempotent upserts.

Start with read-only patient and appointment synchronization.

## Tenant isolation and privacy

Every practice-owned record must be associated with a practice.

Verify authentication, organization membership, practice membership, permissions and resource ownership for every protected operation.

Use appropriate foreign keys, unique constraints and indexes.

Minimize stored patient data and redact sensitive information from logs.

Enforce communication consent and opt-out rules.

Verify webhooks according to provider documentation.

## GitHub and pnpm

Use pnpm for all package operations.

Inspect git status before changes.

Use small, descriptive branches and conventional commits.

Never commit secrets, patient exports, database dumps or sensitive logs.

Do not automatically push, merge, force-push, delete branches or rewrite shared history without explicit authorization.

Use only scripts that exist in package.json.

## Verification

Run applicable lint, type-check, unit tests, integration tests and builds after each milestone.

Run end-to-end tests when the environment supports them.

Test both successful and failed operations, including tenant isolation.

Use mocks explicitly when real integration credentials are unavailable.

Never describe mocked results as real integration verification.

## Definition of done

A feature is complete only when its UI, server logic, validation, authorization, persistence, loading/error states and relevant tests are implemented.

Update documentation and report actual verification results.

Do not mark a feature complete if material security issues or required functionality remain unresolved.