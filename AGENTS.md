# Manchester Piti

## Product

Spanish-first web app for an amateur football club: match-day entry, historical records, player statistics, rankings, and fan-facing storytelling. Read `PRODUCT.md` and `DESIGN.md` before changing user-facing behavior or visual language. Preserve the playful Manchester City parody, mobile-first match-day use, and WCAG 2.1 AA target.

## Stack

- React 19, TypeScript, Vite
- Firebase Authentication and Firestore
- TanStack Router and Query
- Tailwind CSS 4
- Vitest and Playwright

## Package management

Use `pnpm`; the documented setup and repository scripts assume it. The repository currently contains both `pnpm-lock.yaml` and `package-lock.json`. Do not reconcile, delete, or regenerate lockfiles unless dependency work explicitly requires it.

## Commands

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
```

For relevant changes:

```bash
pnpm test:rules
pnpm test:e2e
```

Firestore-rules and CI end-to-end tests require Firebase emulators. Do not point tests at production Firebase resources.

## Working rules

- Never commit `.env` or credentials; use `.env.example`.
- Keep domain logic out of presentation components where practical.
- Preserve Spanish-first copy and mobile behavior.
- Honor `prefers-reduced-motion` and do not encode status by color alone.
- Inspect existing tests before changing behavior; add or update focused tests with the implementation.
- Do not modify unrelated uncommitted files.

## Definition of done

Run `pnpm lint`, `pnpm test`, and `pnpm build`. Run Firestore-rules or Playwright tests when the touched behavior depends on them. Report any command that could not run and why.
