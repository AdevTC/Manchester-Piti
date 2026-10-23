// /vestuario/ficha · «Vincula tu ficha» (CL- boards part-vestuario vx.g.ficha): he picks his name among the season's
// free fichas («Pellete · 20») and asks for it (requestPlayerClaim); a captain approves it (a captain's own links
// at once). The real states stay: the one that looks like his nickname, a request in review (and «elegir otra»),
// the last one rejected. With his ficha already linked, it says so and sends him to his profile.
import { useMemo, useState } from "react";
import { playerName } from "../../../lib/clubData";
import { apiError, requestPlayerClaim } from "../../../lib/clubApi";
import { Go, I } from "../../club/cb/ui";
import { useMyClaim, usePlayerLinks } from "../live";
import type { VxCtx } from "./ctx";
import { fichaChoices } from "./fichaModel";

export function FichaBlock({ c }: { c: VxCtx }) {
  const linked = !!c.playerId;
  const claim = useMyClaim(linked ? undefined : c.uid || undefined).data;
  const links = usePlayerLinks(!linked);
  const nick = c.me?.name ?? "";
  const { options, suggestion } = useMemo(
    () =>
      fichaChoices(c.squad, links.data, nick, (id) => {
        const p = c.players.find((x) => x.id === id);
        return p ? [p.shirtName ?? "", p.firstName ?? "", playerName(p)] : [];
      }),
    [c.squad, c.players, links.data, nick],
  );
  const [picking, setPicking] = useState(false);
  const [sel, setSel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (linked) {
    return (
      <>
        <p className="cb-ok">
          <I n="check" />
          Tu ficha ya está vinculada: {c.nameOf(c.playerId ?? "")}.
        </p>
        <div className="cb-row-acts">
          <Go className="vd-glass vd-press vd-btn vd-btn--sm" href="/perfil">
            Ir a mi ficha
          </Go>
        </div>
      </>
    );
  }

  const pending = claim?.status === "pending";
  const rejected = claim?.status === "rejected";
  const offer = suggestion && !pending ? suggestion : null;
  const showPicker = picking || (!offer && !pending);

  const send = async (id: string) => {
    if (!id) {
      c.say("Elige tu nombre primero.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await requestPlayerClaim({ playerId: id });
      setPicking(false);
      setSel("");
      c.say(r.data.linked ? "Ficha vinculada." : "Solicitud enviada: tu ficha, en revisión.");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pending ? (
        <>
          <p className="cb-ok" role="status">
            <I n="check" />
            Solicitud enviada: tu ficha, en revisión.
          </p>
          <p className="cb-small">
            Has pedido la ficha de <b>{claim.playerName || c.nameOf(claim.playerId)}</b>. En cuanto un capitán la apruebe, tu cartel llevará tu nombre y tu dorsal.
          </p>
        </>
      ) : (
        <p className="cb-small">
          {rejected && <b>Tu última solicitud no se aprobó. </b>}
          {c.admin ? "Elige tu nombre. Como capitán, se vincula al instante." : "Elige tu nombre. Lo aprueba un capitán; mientras tanto, todo el vestuario funciona igual."}
        </p>
      )}

      {offer && !picking && (
        <>
          <p className="cb-small">
            Se parece a tu nombre: <b>{offer.label}</b>
          </p>
          <div className="cb-row-acts">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" disabled={busy} aria-busy={busy || undefined} onClick={() => void send(offer.id)}>
              {busy ? "Vinculando…" : "Sí, es mi ficha"}
            </button>
            <button type="button" className="vd-link" onClick={() => setPicking(true)}>
              Elegir otra
            </button>
          </div>
        </>
      )}

      {pending && !picking && (
        <div className="cb-row-acts">
          <button type="button" className="vd-link" onClick={() => setPicking(true)}>
            No es esa, elegir otra
          </button>
        </div>
      )}

      {showPicker && (
        <>
          <label>
            <span className="vd-label">Elige tu nombre</span>
            <select className="vd-input" value={sel} onChange={(e) => setSel(e.target.value)} disabled={links.loading && !options.length}>
              <option value="">{links.loading && !options.length ? "Cargando las fichas…" : "Elige…"}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {!links.loading && !options.length && <p className="cb-small">No queda ninguna ficha libre esta temporada: pídesela a un capitán.</p>}
          <div className="cb-row-acts">
            <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri vd-btn--sm" disabled={!sel || busy} aria-busy={busy || undefined} onClick={() => void send(sel)}>
              {busy ? "Vinculando…" : "Es mi ficha"}
            </button>
            {(offer || pending) && (
              <button type="button" className="vd-link" onClick={() => setPicking(false)}>
                Cancelar
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <p className="cb-small" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
