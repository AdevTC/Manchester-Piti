# Manchester Piti

## Product

Spanish-first web app for an amateur football club: match-day entry, historical records, player statistics, rankings, and fan-facing storytelling. Read `PRODUCT.md` and `DESIGN.md` before changing user-facing behavior or visual language. Preserve the playful Manchester City parody, mobile-first match-day use, and WCAG 2.1 AA target.

## Stack

- React 19, TypeScript, Vite
- Firebase Authentication and Firestore
- TanStack Router and Query
- Tailwind CSS 4 and shadcn/ui (components in `src/components/ui`, themed through the `--mp-*` variables)
- Zod, React Hook Form and Motion; three.js for the 3D scenes
- Vitest and Playwright
- Oxlint (`pnpm lint`)

## Package management

Use `pnpm`; the documented setup and repository scripts assume it. The repository currently contains both `pnpm-lock.yaml` and `package-lock.json`. Do not reconcile, delete, or regenerate lockfiles unless dependency work explicitly requires it.

## Commands

```bash
pnpm dev
pnpm lint
pnpm test
pnpm build
pnpm emulators   # local auth, Firestore and Functions emulators
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

## Workflow in this repo

- No pull requests: merge into `main` locally, run `pnpm lint`, `pnpm test` and `pnpm build` once per batch, then push. Never force-push.
- Deploy Firebase functions and rules once per batch, only when they changed.
- A push through a token URL doesn't move `origin/main`: run `git update-ref refs/remotes/origin/main main` afterwards, because worktree agents branch from that ref.

## Local testing

- Seed the emulators with `node functions/test/seed-preview.mjs` (needs a local `functions/.secret.local`).
- Never type the team password: sign in with «Google de prueba · Solo emulador», set `sessionStorage['piti-vestuario-session']` to the seeded uid and reload.
- Gated screens in dev: `?preview` mocks an admin session; `?login` shows the login screen while signed in.
- On Windows, `emulators:exec` leaves java processes on ports 8080, 9150, 9099 and 5001; kill them before the next run.
- Repo files use CRLF (`core.autocrlf=true`); scripts that patch files must split and join on CRLF.
- Before changing an existing screen, look at the real screen running locally with production-shaped data and extend it rather than redesigning from old sources.

## Definition of done

Run `pnpm lint`, `pnpm test`, and `pnpm build`. Run Firestore-rules or Playwright tests when the touched behavior depends on them. Report any command that could not run and why.
