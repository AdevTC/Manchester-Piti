// La mesa (r12) · what stays on every screen: the head (back, the score in wide type, the clock in Geist Mono, who is
// scoring and whether the phone is up to date, «Reloj» while a half is on), the band «Sin red» / «Por revisar», and
// the status line in the thumb zone with the last word and «Deshacer» (never over a control).
import type { MesaView } from "../types";
import { matchLine, partWord, plural, presenceOf, shownScore } from "./derive";
import { Icon, Kbd } from "./parts";
import type { useBoard } from "./useBoard";

type B = ReturnType<typeof useBoard>;

export function Top({ v, b }: { v: MesaView; b: B }) {
  const c = v.match.clock;
  const sc = shownScore(v);
  const part = partWord(v);
  const who = presenceOf(v);
  const inHalf = c.phase === "first" || c.phase === "second";
  const back = b.screen === "cronica" ? "Volver a la mesa" : b.screen === "lista" ? "Volver a la previa" : "Salir de la mesa";
  const goBack = () => (b.screen === "cronica" ? v.nav.mesa() : b.screen === "lista" ? b.setLista(false) : v.nav.exit());
  return (
    <header className="me-top vd-reg-1">
      <button type="button" className="vd-ibtn vd-glass vd-press me-back" onClick={goBack} aria-label={back}>
        <Icon name="chev-l" />
      </button>
      <div className="me-board-t">
        <p className="me-score" style={{ viewTransitionName: "me-score" }} aria-label={`Manchester Piti ${sc.us}, ${v.match.rival} ${sc.them}`}>
          <span className="me-score__us" aria-hidden="true">PITI</span>
          <b className="vd-score me-score__n" aria-hidden="true">{sc.us}–{sc.them}</b>
          <span className="me-score__them" aria-hidden="true">{v.match.rivalShort}</span>
        </p>
        <p className="me-clock" role={inHalf ? "timer" : "status"} aria-label={`${part}, ${c.text}${c.added ? `, añadido ${c.added} minutos` : ""}${c.held ? ", en pausa" : ""}`}>
          <span className="vd-clock me-clock__t" aria-hidden="true">{c.text}</span>
          <span className="me-clock__p" aria-hidden="true">{part}</span>
          {c.added > 0 && <span className="me-clock__a" aria-hidden="true">+{c.added}′</span>}
          {c.held && inHalf && <span className="me-tag me-tag--quiet me-clock__pause">En pausa</span>}
        </p>
      </div>
      <div className="me-top__r">
        <p className={`me-who ${who.cls}`} aria-label={who.label}>
          {who.off && <Icon name="wifiOff" />}
          <span>{who.text}</span>
        </p>
        {b.screen === "juego" && (
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm me-relojbtn" onClick={() => b.openSheet("reloj")} aria-haspopup="dialog" aria-keyshortcuts="Space">
            <Icon name="clock" />
            <span>Reloj</span>
            <Kbd>Espacio pausa</Kbd>
          </button>
        )}
      </div>
      <p className="me-top__match">{matchLine(v)}</p>
    </header>
  );
}

export function Band({ v, b }: { v: MesaView; b: B }) {
  const q = v.queue;
  if (q.online && !q.review.length) return null;
  return (
    <div className="me-band" role="status">
      {!q.online && (
        <div className="me-band__r">
          <Icon name="wifiOff" />
          <p className="me-band__t">Sin red. {plural(q.pending, "jugada guardada en el móvil", "jugadas guardadas en el móvil")} · se suben solas al volver la señal</p>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => { v.actions.retryNow(); b.say("Sin red", "Lo intentamos cada 5 s; en cuanto haya señal se suben en orden.", "warn"); }}>Subir ahora</button>
        </div>
      )}
      {q.review.length > 0 && (
        <div className="me-band__r">
          <Icon name="warn" />
          <p className="me-band__t">Por revisar. {plural(q.review.length, "jugada", "jugadas")} que el servidor no aceptó</p>
          <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => b.openSheet("revisar")} aria-haspopup="dialog">Revisar</button>
        </div>
      )}
    </div>
  );
}

export function Line({ v, b, now }: { v: MesaView; b: B; now: number }) {
  const s = b.status;
  const last = [...v.events].sort((x, y) => (y.elapsedSeconds ?? 0) - (x.elapsedSeconds ?? 0))[0];
  if (!s) {
    const rest = last ? `${last.minute ?? "–"}′ · ${last.text} · ${last.mine ? "lo apuntaste tú" : `lo apuntó ${last.byName ?? "otro anotador"}`}${last.local ? " · en el móvil" : ""}` : b.screen === "antes" || b.screen === "lista" ? "Aún no ha pasado nada · la mesa se abre al pitar" : "Aún no ha pasado nada";
    return (
      <footer className="me-line is-rest" role="status" aria-live="polite">
        <span className="me-line__rest">{rest}</span>
        {v.match.clock.held && (v.match.clock.phase === "first" || v.match.clock.phase === "second") && (
          <button type="button" className="me-line__btn" onClick={() => b.clockAct("pause")}>Seguir</button>
        )}
      </footer>
    );
  }
  const holdLeft = s.hold ? Math.max(0, Math.ceil((s.hold - now) / 1000)) : 0;
  let msg = s.msg;
  if (s.tone === "them") msg = !v.queue.online ? "Ya cuenta · en el móvil: el aviso sale cuando se suba" : holdLeft ? `Ya cuenta · el aviso al club sale en ${holdLeft} s` : `Avisado al club: «Gol de ${v.match.rival}»`;
  const cls = `me-line is-${s.tone || "plain"}${s.undo && s.tone === "them" && holdLeft ? " is-hold" : ""}`;
  return (
    <footer className={cls} role="status" aria-live="polite">
      <span className="me-line__tag">{s.tag}</span>
      <span className="me-line__msg">{msg}</span>
      {s.act && (
        <button type="button" className="me-line__btn" onClick={s.act.go}>{s.act.t}</button>
      )}
      {s.undo && (
        <button type="button" className="me-line__btn me-line__undo" onClick={b.undo} aria-keyshortcuts="Z">
          <Icon name="undo" />Deshacer<Kbd>Z</Kbd>
        </button>
      )}
    </footer>
  );
}
