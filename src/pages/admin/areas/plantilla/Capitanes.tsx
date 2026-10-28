// PLANTILLA · Capitanes (/admin/plantilla/capitanes): el brazalete (the permission: who enters the sala) and, apart,
// el capitán en el campo of each season (no permissions; it is the web's) (M-15; board part-plantilla.html §
// capitanes). «Con brazalete N»: the initial with its «C» (gold: the capitán general, protected, also by the founder's
// e-mail), «Último capitán» (the club never runs out of them), «Quitar el brazalete» — M-40: another captain's only
// for the capitán general; everyone can take off his own, warned that he leaves the sala —; «Socios N» with «Dar el
// brazalete». Both confirm in place with their consequences and wait 5 s behind «Deshacer». The field captain: a
// select of that season's squad per season (an archived one says so with a quiet tag). The rules aside, with the
// door in Socios and the seasons in Club.
import { useEffect, useMemo, useRef, useState } from "react";
import { useShirtStills } from "../../../../components/jersey3d/useShirtStills";
import { useAuth } from "../../../../context/AuthContext";
import { useDocumentTheme } from "../../../../hooks/useDocumentTheme";
import type { PersonRow } from "../../../vestuario/live";
import { seasonCode } from "../../club/plantillaLogic";
import { useClubWrites } from "../../club/useClubWrites";
import type { AdminData } from "../../data/useAdminData";
import { useAdmin } from "../../shell/context";
import { SalaLink } from "../../shell/SalaLink";
import { SalaScreen, ScreenError, ScreenLoading } from "../../shell/Screen";
import { useStatus } from "../../shell/statusContext";
import { Icon, PlNav, Shirt } from "./parts";
import { armConsequences, handleOf, initialOf, isGeneral, RANK, ROLE_WORD, roleOf, shirtIn, shirtLabel, shirtLookup, shirtOption, type Role, type ShirtOf } from "./sociosModel";
import "./plantilla.css";

const LEDE = "Quién lleva el brazalete (entra en la sala) y, aparte, el capitán en el campo de cada temporada (sin permisos).";

export function CapitanesScreen() {
  const data = useAdmin();
  if (data.loading) return <ScreenLoading label="Cargando los capitanes" />;
  if (data.error) return <ScreenError what="los capitanes" onRetry={() => window.location.reload()} />;
  return <Capitanes data={data} />;
}

type Member = PersonRow & { r: Role };

function Capitanes({ data }: { data: AdminData }) {
  const status = useStatus();
  const writes = useClubWrites();
  const { user, profile } = useAuth();
  const me = user?.uid ?? "";
  const general = isGeneral(profile);
  const theme = useDocumentTheme();
  // (a change is shown while the listener still has what it was made on: written, the listener brings it)
  const [pending, setPending] = useState<Record<string, { from: Role; to: "admin" | "user" }>>({});
  const [fieldCap, setFieldCap] = useState<Record<string, { from: string; to: string }>>({});
  const [ask, setAsk] = useState("");

  // where the focus goes once a confirm closes (never dropped to <body>)
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    const el = root.current?.querySelector<HTMLElement>(`[data-focus="${key}"]`);
    if (!el) return;
    el.focus();
    if (document.activeElement === el) focusNext.current = null;
  });

  const shirtOf = useMemo(() => shirtLookup({ roster: data.roster, players: data.players, archivedPlayers: data.archivedPlayers, season: data.season }), [data.roster, data.players, data.archivedPlayers, data.season]);
  const members: Member[] = useMemo(
    () =>
      data.people
        .filter((p) => !p.removed)
        .map((p) => {
          const r = roleOf(p);
          const w = pending[p.uid];
          return { ...p, r: r !== "superadmin" && w && w.from === r ? w.to : r };
        })
        .sort((a, b) => RANK[a.r] - RANK[b.r] || (a.nickname || a.email).localeCompare(b.nickname || b.email, "es")),
    [data.people, pending],
  );
  const caps = members.filter((m) => m.r !== "user");
  const socios = members.filter((m) => m.r === "user");
  const generalName = (() => {
    const g = members.find((m) => m.r === "superadmin");
    return g?.displayName ?? "";
  })();

  const toggle = (uid: string) => {
    if (ask === uid) focusNext.current = `arm-${uid}`;
    setAsk((a) => (a === uid ? "" : uid));
  };
  const cancel = (uid: string) => {
    setAsk("");
    focusNext.current = `arm-${uid}`;
  };
  const setArm = (m: Member, to: "admin" | "user") => {
    const who = handleOf(m);
    setAsk("");
    setPending((p) => ({ ...p, [m.uid]: { from: roleOf(m), to } }));
    focusNext.current = to === "admin" ? "arm-h" : "socios-h";
    const done = () =>
      setPending((p) => {
        const n = { ...p };
        delete n[m.uid];
        return n;
      });
    status.defer({
      tag: "Brazalete",
      message: to === "admin" ? `${who} ya lleva el brazalete` : `${who} deja el brazalete · sigue como socio`,
      commit: () => writes.setRole(m.uid, m.email, to),
      onUndo: done,
      onError: done,
      errorMessage: "No se ha podido cambiar el brazalete",
    });
  };

  // ---------- el capitán en el campo
  const seasonSquad = (sid: string): ShirtOf[] =>
    data.players
      .filter((p) => !p.archived && (p.seasons ?? []).includes(sid))
      .map((p) => shirtIn(p, sid))
      .sort((a, b) => (Number(a.num) || 999) - (Number(b.num) || 999) || a.name.localeCompare(b.name, "es"));
  const anyShirt = (id: string, sid: string): ShirtOf | null => {
    const p = [...data.players, ...data.archivedPlayers].find((x) => x.id === id);
    return p ? shirtIn(p, sid) : shirtOf(id);
  };
  const fields = data.seasons.map((s) => {
    const now = s.captainPlayerId ?? "";
    const w = fieldCap[s.id];
    const v = w && w.from === now ? w.to : now;
    return { s, v, cp: v ? anyShirt(v, s.id) : null, squad: s.archived ? [] : seasonSquad(s.id) };
  });
  const pickField = (sid: string, name: string, v: string, from: string) => {
    const np = v ? anyShirt(v, sid) : null;
    setFieldCap((f) => ({ ...f, [sid]: { from, to: v } }));
    const back = () =>
      setFieldCap((f) => {
        const n = { ...f };
        delete n[sid];
        return n;
      });
    const code = seasonCode(name);
    status.defer({
      tag: "Capitán en el campo",
      message: np ? `Capitán de la ${code}: ${np.name} · sale con el brazalete en la web` : `La ${code} se queda sin capitán en el campo`,
      commit: () => writes.saveSeason(sid, { captainPlayerId: v }),
      onUndo: back,
      onError: back,
      errorMessage: "No se ha podido cambiar el capitán en el campo",
    });
  };

  // the printed stills: each season's field captain, and the plain kit's
  const shot = (s: ShirtOf) => ({ kit: "home" as const, theme, name: s.name.toLocaleUpperCase("es"), num: s.num });
  const plain = { kit: "home" as const, theme, name: "", num: "" };
  const stillOf = useShirtStills([plain, ...fields.flatMap((f) => (f.cp ? [shot(f.cp)] : []))]);

  const row = (m: Member) => {
    const mine = m.uid === me;
    const who = `${handleOf(m)}${mine ? " · tú" : ""}`;
    const shirt = shirtOf(m.playerId);
    const sub = [ROLE_WORD[m.r], m.displayName, shirt?.name].filter(Boolean).join(" · ");
    const hasArm = m.r !== "user";
    const last = hasArm && caps.length <= 1;
    // M-40: another captain's brazalete is only the general's to take off; each captain can take off his own
    const act = m.r === "superadmin" ? "protegido" : last ? "ultimo" : m.r === "admin" ? (mine || general ? "quitar" : "solo") : "dar";
    const open = ask === m.uid && (act === "quitar" || act === "dar");
    const give = act === "dar";
    const label = `${give ? "Dar el brazalete a" : "Quitar el brazalete a"} ${handleOf(m)}`;
    return (
      <li key={m.uid} className="spl-person">
        <div className="sc-row">
          <span className={`spl-ini${hasArm ? ` spl-ini--arm is-${m.r}` : ""}`} aria-hidden="true">
            {initialOf(m)}
            {hasArm && <b>C</b>}
          </span>
          <span className="sc-row__t">
            <b>{who}</b>
            <span>{sub}</span>
            {hasArm && m.email && <span>{m.email}</span>}
          </span>
          {act === "protegido" && (
            <span className="spl-lock">
              <Icon name="lock" size={16} />
              {mine ? "Eres tú · protegido" : "Protegido"}
            </span>
          )}
          {act === "ultimo" && (
            <span className="spl-lock">
              <Icon name="lock" size={16} />
              Último capitán
            </span>
          )}
          {act === "solo" && (
            <span className="spl-lock">
              <Icon name="lock" size={16} />
              Solo el capitán general
            </span>
          )}
          {(act === "quitar" || act === "dar") && (
            <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" aria-expanded={open} aria-label={label} data-focus={`arm-${m.uid}`} onClick={() => toggle(m.uid)}>
              {give ? "Dar el brazalete" : "Quitar el brazalete"}
            </button>
          )}
        </div>
        {open && (
          <div className="spl-confirm" role="group" aria-label={label}>
            <p className="sc-h3">
              {give ? "¿Dar el brazalete a" : "¿Quitar el brazalete a"} {handleOf(m)}?
            </p>
            <ul className="spl-conseq">
              {armConsequences(give, mine).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="sc-btnrow">
              <button type="button" className={`vd-btn vd-glass vd-press vd-btn--sm ${give ? "vd-btn--pri" : "spl-danger"}`} onClick={() => setArm(m, give ? "admin" : "user")}>
                {give ? "Dar el brazalete" : "Quitar el brazalete"}
              </button>
              <button type="button" className="vd-btn vd-glass vd-press vd-btn--sm" onClick={() => cancel(m.uid)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <SalaScreen title="Capitanes" lede={LEDE} headSub="El brazalete y el capitán en el campo" actions={<PlNav at="capitanes" />} fit className="sc-pl pl--capitanes">
      <div className="spl-cap" ref={root}>
        <section className="spl-cap__arm" aria-labelledby="spl-c-arm">
          <header className="sc-sec__h">
            <h2 className="sc-h2" id="spl-c-arm">
              El brazalete
            </h2>
            <span className="sc-small">Quien lo lleva entra en la sala</span>
          </header>
          <h3 className="sc-h3 spl-sub" id="spl-c-with" tabIndex={-1} data-focus="arm-h">
            Con brazalete <span className="sc-sec__n">{caps.length}</span>
          </h3>
          <ul className="sc-rows" aria-labelledby="spl-c-with">
            {caps.map(row)}
          </ul>
          <h3 className="sc-h3 spl-sub" id="spl-c-soc" tabIndex={-1} data-focus="socios-h">
            Socios <span className="sc-sec__n">{socios.length}</span>
          </h3>
          {!socios.length && <p className="sc-small spl-quiet">Todos los de dentro llevan el brazalete. Los nuevos entran por la puerta.</p>}
          <ul className="sc-rows" aria-labelledby="spl-c-soc">
            {socios.map(row)}
          </ul>
        </section>

        <section className="spl-cap__field" aria-labelledby="spl-c-field">
          <header className="sc-sec__h">
            <h2 className="sc-h2" id="spl-c-field">
              El capitán en el campo
            </h2>
          </header>
          <p className="sc-small">Otra cosa distinta del brazalete: el que lleva la cinta en el campo y sale así en la web. No da permisos ni entra en la sala.</p>
          <ul className="sc-rows">
            {fields.map(({ s, v, cp, squad }) => {
              const id = `spl-cap-${s.id}`;
              // (a captain who is no longer in the season's squad stays a choice, so the select says who he is)
              const opts = cp && !squad.some((x) => x.id === cp.id) ? [cp, ...squad] : squad;
              return (
                <li key={s.id} className="sc-row spl-fcap">
                  <Shirt src={cp ? stillOf(shot(cp)) : stillOf(plain)} size="s" alt={cp ? `Camiseta de ${cp.name}` : "Sin capitán"} />
                  <span className="sc-row__t">
                    <b>
                      {s.name}
                      {s.archived ? " · archivada" : ""}
                    </b>
                    <span>{cp ? shirtLabel(cp) : "Sin capitán en el campo"}</span>
                  </span>
                  {s.archived ? (
                    <span className="spl-fcap__tag">
                      <span className="sc-tag sc-tag--quiet">Archivada</span>
                    </span>
                  ) : (
                    <label className="spl-fcap__sel" htmlFor={id}>
                      <span className="vd-vh">Capitán en el campo de la {s.name}</span>
                      <select className="vd-input vd-glass" id={id} value={v} onChange={(e) => pickField(s.id, s.name, e.target.value, s.captainPlayerId ?? "")}>
                        <option value="">— Sin capitán —</option>
                        {opts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {shirtOption(p)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          <SalaLink className="vd-link" to="/admin/club/temporadas">
            Las temporadas, en Club ›
          </SalaLink>
        </section>

        <aside className="spl-cap__rules" aria-labelledby="spl-c-rules">
          <h2 className="sc-h3" id="spl-c-rules">
            Las normas del brazalete
          </h2>
          <ul className="spl-rules">
            <li>Quien lleva el brazalete convoca, publica actas, abre la puerta y aprueba cuentas.</li>
            <li>{generalName ? `${generalName} es el capitán general` : "El capitán general"}: fundó el club y nadie le puede quitar ni el brazalete ni el acceso.</li>
            <li>Siempre queda al menos un capitán: el último no se puede quitar.</li>
            <li>Solo el capitán general quita el brazalete o el acceso a otro capitán; cada uno puede quitarse el suyo.</li>
            <li>Quitar el acceso a un capitán le quita también el brazalete: si vuelve, entra como socio.</li>
            <li>Para ser socio, primero se entra por la puerta.</li>
          </ul>
          <SalaLink className="vd-link" to="/admin/plantilla/socios">
            <Icon name="door" size={18} />
            La puerta, en Socios ›
          </SalaLink>
        </aside>
      </div>
    </SalaScreen>
  );
}
