// r14 «La pizarra» · Jugadas: what the place tells the shell (MARCO.txt § registerPlace) and the Dibujar tool (the dock
// over the pitch while P.state.drawing, in the Siete and in Jugadas › Editar). Owned by the JUGADAS agent.
// Loaded eagerly by places/index.ts (keep it light: the components themselves are lazy).
import { lazyPart } from "../../store/lazyPart";
import { registerDrawingRenderer, registerPlace, registerTool } from "../../store/registry";
import { U, canMake, cur, newPlay, own, pause, play, setMode, team } from "./engine";
import { strokePath } from "./drawView";

registerPlace("jugadas", {
  Component: lazyPart(() => import("./Jugadas").then((m) => m.Jugadas)),
  sub: (P) => String(team(P).length + own(P).length),
  primary: (P) => {
    const pj = cur(P);
    if (!pj) return canMake(P) ? { label: "Nueva jugada", short: "Nueva", icon: "plus", run: () => newPlay(P) } : { label: "La charla", short: "Charla", icon: "mic", run: () => P.nav("/pizarra/charla") };
    const u = U(P);
    if (u.mode === "editar") return { label: "Listo", short: "Listo", icon: "check", run: () => setMode(P, "ver") };
    if (u.playing) return { label: "Pausar", short: "Pausar", icon: "pause", run: () => pause(P) };
    const end = u.step >= pj.steps.length - 1 && pj.steps.length > 1;
    return { label: end ? "Otra vez" : "Reproducir", short: end ? "Otra vez" : "Ver", icon: "play", run: () => play(P) };
  },
  share: "compartir",
});

registerTool(
  "dibujar",
  lazyPart(() => import("./Dibujar").then((m) => m.Dibujar)),
);
// How a board's stored stroke is drawn on the pitch (the Siete shows them with their colours, always: JUG-100).
registerDrawingRenderer((s) => strokePath(s, null));
