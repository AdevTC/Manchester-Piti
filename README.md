# Manchester Piti

La web del Manchester Piti, equipo amateur de fútbol 7: resultados, histórico de partidos y jugadores, estadísticas y rankings, y un vestuario privado para el equipo (disponibilidad, MVP, pizarra táctica, actas).

- Qué es y para quién: [`PRODUCT.md`](PRODUCT.md)
- Lenguaje visual: [`DESIGN.md`](DESIGN.md)
- Uso del club (temporadas, actas, vestuario): [`docs/GUIA-NUEVA-WEB.md`](docs/GUIA-NUEVA-WEB.md)
- Normas para agentes y colaboradores: [`AGENTS.md`](AGENTS.md)

## Stack

- React 19, TypeScript 7, Vite 8 (Rolldown), React Compiler
- TanStack Router y Query, Zod, React Hook Form, Motion
- Tailwind CSS 4 + shadcn/ui
- Firebase: Auth, Firestore y Cloud Functions v2 en `europe-southwest1` (Madrid)
- Vercel para el hosting; PWA con service worker (Workbox)
- Oxlint (con reglas que usan tipos), Vitest y Playwright

## Puesta en marcha

```bash
pnpm install
cp .env.example .env   # rellena la config web de Firebase
pnpm dev               # http://localhost:3000
```

Contra los emuladores de Firebase (sin tocar producción):

```bash
pnpm emulators
```

## Comprobaciones

```bash
pnpm lint        # oxlint
pnpm test        # vitest
pnpm build       # tsc -b + vite build
pnpm test:rules  # reglas de Firestore (emulador)
pnpm test:e2e    # Playwright
```

Las Cloud Functions viven en [`functions/`](functions) (npm, Node 24): `npm --prefix functions run build`.
