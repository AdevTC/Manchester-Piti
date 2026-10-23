// «La puerta» grown in place (/vestuario/puerta, captains only; CL- boards part-vestuario vx.g.puerta): three tabs,
// «Llamando» (each request with «Abrir» / «No», its ficha changeable, a short undo before it applies), «Invitar»
// (a 7-day link with its ficha and uses, «Copiar», «WhatsApp», the live passes with «Revocar») and «Dentro» (who
// has access, «Quitar acceso» with a confirm). The push «Avísame cuando alguien llame» sits on top.
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { inviteUrl } from "../../../lib/door";
import { pushState, savedTopics, toggleTopic } from "../../../lib/push";
import { I } from "../../club/cb/ui";
import { useCaptainDoor } from "../../acceso/useCaptainDoor";
import type { VxCtx } from "./ctx";
import { fichaLabel, insideLine, knockFicha, knockNick, passLine, passTitle, since, waText, type DoorTab, type SquadShirt } from "./puertaModel";

const BTN = "vd-glass vd-press vd-btn vd-btn--sm";
const TAB_IDS = ["cb-door-ll", "cb-door-inv", "cb-door-de"] as const;

export function PuertaBlock({ c }: { c: VxCtx }) {
  const cap = useCaptainDoor();
  const [tab, setTab] = useState<DoorTab>(0);
  const byId = useMemo(() => new Map<string, SquadShirt>(c.squad.map((s) => [s.id, s])), [c.squad]);
  const [doorPush, setDoorPush] = useState(() => savedTopics().includes("door"));
  const pushReady = pushState() === "ready";
  const togglePush = async () => {
    try {
      const t = await toggleTopic("door", !doorPush);
      setDoorPush(t.includes("door"));
    } catch {
      setDoorPush(savedTopics().includes("door"));
    }
  };

  const tabs = [`Llamando · ${cap.queue.length}`, "Invitar", `Dentro · ${cap.inside.length}`];
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = ((tab + step + 3) % 3) as DoorTab;
    setTab(next);
    document.getElementById(`${TAB_IDS[next]}-t`)?.focus();
  };

  return (
    <>
      {pushReady && (
        <button type="button" className="vd-switch" role="switch" aria-checked={doorPush} onClick={() => void togglePush()}>
          <span className="vd-switch__track" aria-hidden="true">
            <span className="vd-switch__knob" />
          </span>
          {doorPush ? "Te avisamos cuando llamen" : "Avísame cuando alguien llame"}
        </button>
      )}
      <div className="vd-glass vd-seg cb-doortabs" role="tablist" aria-label="La puerta" style={{ "--n": 3, "--i": tab } as CSSProperties} onKeyDown={onTabKey}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        {tabs.map((t, i) => (
          <button key={TAB_IDS[i]} id={`${TAB_IDS[i]}-t`} type="button" role="tab" className="vd-seg__b" aria-selected={tab === i} aria-controls={TAB_IDS[i]} tabIndex={tab === i ? 0 : -1} onClick={() => setTab(i as DoorTab)}>
            {t}
          </button>
        ))}
      </div>
      {cap.error && (
        <p className="cb-small" role="alert">
          {cap.error}
        </p>
      )}
      <div id={TAB_IDS[0]} role="tabpanel" aria-labelledby={`${TAB_IDS[0]}-t`} hidden={tab !== 0}>
        <Llamando cap={cap} byId={byId} squad={c.squad} />
      </div>
      <div id={TAB_IDS[1]} role="tabpanel" aria-labelledby={`${TAB_IDS[1]}-t`} hidden={tab !== 1}>
        <Invitar cap={cap} byId={byId} squad={c.squad} now={c.now} say={c.say} />
      </div>
      <div id={TAB_IDS[2]} role="tabpanel" aria-labelledby={`${TAB_IDS[2]}-t`} hidden={tab !== 2}>
        <Dentro cap={cap} byId={byId} say={c.say} />
      </div>
    </>
  );
}

type Cap = ReturnType<typeof useCaptainDoor>;
interface PanelProps {
  cap: Cap;
  byId: ReadonlyMap<string, SquadShirt>;
}

function Llamando({ cap, byId, squad }: PanelProps & { squad: readonly SquadShirt[] }) {
  // the ficha a captain changed before opening (by the request's uid)
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [chg, setChg] = useState<string | null>(null);
  const free = squad.filter((s) => !cap.linked.has(s.id));
  const p = cap.pending;
  const pendingName = p ? (p.playerId && byId.get(p.playerId)?.name) || knockNick(p.row) : "";
  return (
    <>
      {cap.queue.length > 0 && (
        <ul className="cb-knock" aria-label="Llamando a la puerta">
          {cap.queue.map((r) => {
            const fid = fixed[r.uid] ?? r.playerId ?? "";
            const nick = knockNick(r);
            const ficha = knockFicha(fid || null, fid === r.playerId ? r.playerName : null, byId);
            return (
              <li key={r.uid}>
                <div>
                  <b>{nick}</b>
                  <span>
                    {ficha === "Sin ficha" ? "Sin ficha" : `Quiere entrar como ${ficha}`}
                    {r.email ? <span className="vd-vh"> · {r.email}</span> : null}
                  </span>
                  <button type="button" className="vd-link" aria-expanded={chg === r.uid} aria-label={`Cambiar ficha de ${nick}`} onClick={() => setChg(chg === r.uid ? null : r.uid)}>
                    Cambiar ficha
                  </button>
                  {chg === r.uid && (
                    <label>
                      <span className="vd-label">Ficha para {nick}</span>
                      <select
                        className="vd-input"
                        value={fid}
                        onChange={(e) => {
                          setFixed((f) => ({ ...f, [r.uid]: e.target.value }));
                          setChg(null);
                        }}
                      >
                        <option value="">Sin ficha · el capitán se la hace</option>
                        {free.map((s) => (
                          <option key={s.id} value={s.id}>
                            {fichaLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <button type="button" className={`${BTN} vd-btn--pri`} aria-label={`Abrir a ${nick}`} onClick={() => cap.decide(r, true, fid || undefined)}>
                  Abrir
                </button>
                <button type="button" className={BTN} aria-label={`No abrir a ${nick}`} onClick={() => cap.decide(r, false)}>
                  No
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {!cap.queue.length && <p className="cb-empty">{cap.loading ? "Mirando quién llama…" : "Túnel en silencio: nadie llamando a la puerta."}</p>}
      {p && (
        <p className="cb-ok" role="status">
          <I n={p.approve ? "check" : "close"} />
          <span>{p.approve ? `${pendingName} entra · le llega un aviso.` : `Petición de ${pendingName} rechazada.`}</span>
          <button type="button" className="vd-link" onClick={cap.undo}>
            Deshacer
          </button>
        </p>
      )}
    </>
  );
}

function Invitar({ cap, byId, squad, now, say }: PanelProps & { squad: readonly SquadShirt[]; now: number; say: (t: string) => void }) {
  const [ficha, setFicha] = useState("");
  const [uses, setUses] = useState<0 | 1>(1);
  const [made, setMade] = useState<{ code: string; playerId: string; uses: 0 | 1 } | null>(null);
  const [copied, setCopied] = useState(false);
  const free = squad.filter((s) => !cap.linked.has(s.id));
  const link = made ? inviteUrl(typeof window !== "undefined" ? window.location.origin : "", made.code) : "";
  const madeFor = made?.playerId ? byId.get(made.playerId) : undefined;
  const create = async () => {
    const out = await cap.invite({ ...(ficha ? { playerId: ficha } : {}), maxUses: uses, days: 7 });
    if (out) {
      setMade({ code: out.code, playerId: ficha, uses });
      setCopied(false);
      say("Enlace creado: caduca en 7 días.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      say("Enlace copiado.");
    } catch {
      setCopied(false);
      say("No se pudo copiar: mantén pulsado el enlace para copiarlo.");
    }
  };
  const busy = cap.busy === "invite";
  return (
    <>
      <p className="cb-small">Un enlace y entra sin esperar. Caduca solo en 7 días.</p>
      <label>
        <span className="vd-label">Ficha reservada · opcional</span>
        <select className="vd-input" value={ficha} onChange={(e) => setFicha(e.target.value)}>
          <option value="">Sin ficha · que elija al entrar</option>
          {free.map((s) => (
            <option key={s.id} value={s.id}>
              {fichaLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <div className="vd-glass vd-seg" role="radiogroup" aria-label="Usos del enlace" style={{ "--n": 2, "--i": uses === 1 ? 0 : 1 } as CSSProperties}>
        <span className="vd-shelf__bead" aria-hidden="true" />
        <button type="button" role="radio" className="vd-seg__b" aria-checked={uses === 1} onClick={() => setUses(1)}>
          1 uso
        </button>
        <button type="button" role="radio" className="vd-seg__b" aria-checked={uses === 0} onClick={() => setUses(0)}>
          Ilimitado
        </button>
      </div>
      <div className="cb-row-acts">
        <button type="button" className={`${BTN} vd-btn--pri`} onClick={() => void create()} disabled={busy} aria-busy={busy}>
          {busy ? "Creando…" : made ? "Crear otro enlace" : "Crear enlace"}
        </button>
        <button type="button" className={BTN} onClick={() => void copy()} disabled={!made}>
          {copied ? "Copiado" : "Copiar"}
        </button>
        {made ? (
          <a className={BTN} href={`https://wa.me/?text=${encodeURIComponent(waText(link, madeFor?.name))}`} target="_blank" rel="noreferrer">
            WhatsApp
          </a>
        ) : (
          <button type="button" className={BTN} disabled>
            WhatsApp
          </button>
        )}
      </div>
      <p className="cb-small">
        <code className="cb-code">{link || "Aún no has creado ningún enlace."}</code>
      </p>
      {made && (
        <p className="cb-small">
          {madeFor ? `Para ${fichaLabel(madeFor)}` : "Sin ficha"} · {made.uses === 0 ? "Ilimitado" : "1 uso"} · 7 días
        </p>
      )}
      <h4>Pases activos · {cap.invites.length}</h4>
      {cap.invites.length ? (
        <ul className="cb-knock" aria-label="Pases activos">
          {cap.invites.map((v) => {
            const title = passTitle(v, byId);
            return (
              <li key={v.code}>
                <div>
                  <b>{title}</b>
                  <span>{passLine(v, now)}</span>
                </div>
                <button type="button" className="vd-link" onClick={() => void cap.revokeInvite(v.code).then((ok) => ok && say("Enlace revocado: deja de funcionar al momento."))} disabled={cap.busy === `inv:${v.code}`} aria-label={`Revocar el pase ${title}`}>
                  Revocar
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cb-empty">Sin pases activos: crea uno con «Crear enlace».</p>
      )}
    </>
  );
}

function Dentro({ cap, byId, say }: PanelProps & { say: (t: string) => void }) {
  const [confirm, setConfirm] = useState<string | null>(null);
  return (
    <>
      <p className="cb-small">{insideLine(cap.inside.length)}</p>
      <ul className="cb-knock" aria-label="Dentro del vestuario">
        {cap.inside.map((m) => {
          const p = m.person!;
          const shirt = p.playerId ? byId.get(p.playerId) : undefined;
          const name = shirt?.name ?? (p.nickname || p.displayName || p.email);
          const captain = p.role === "admin" || p.role === "superadmin";
          const line = m.me ? "Tú" : since(m.joinedAt);
          const asking = confirm === m.uid;
          return (
            <li key={m.uid}>
              <div>
                <b>{name}</b>
                <span>{captain ? `Capitán · ${line.charAt(0).toLowerCase()}${line.slice(1)}` : line}</span>
                {asking && (
                  <span role="alert">
                    ¿Quitar a <b>{name}</b>? Se le cierra en todos sus móviles.
                  </span>
                )}
              </div>
              {m.me || p.role === "superadmin" ? null : asking ? (
                <>
                  <button
                    type="button"
                    className={`${BTN} vd-btn--pri`}
                    onClick={() => {
                      setConfirm(null);
                      void cap.removeMember(m.uid).then((ok) => ok && say("Acceso quitado. Su ficha sigue en la plantilla."));
                    }}
                  >
                    Quitar
                  </button>
                  <button type="button" className="vd-link" onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <button type="button" className="vd-link" onClick={() => setConfirm(m.uid)} disabled={cap.busy === `mem:${m.uid}`} aria-label={`Quitar acceso a ${name}`}>
                  Quitar acceso
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
