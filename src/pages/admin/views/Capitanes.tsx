// Capitanes (/admin/capitanes) — who wears the armband. «Con brazalete» as lockers (the avatar with its «C»;
// gold = the capitán general, protected: nobody takes his armband) and «Socios» as a list. «Dar el
// brazalete» / «Quitar el brazalete» ask first (what changes) and wait behind a lower third with «Deshacer»;
// the club never runs out of captains (the last one cannot take his own off), and taking off your own says
// you lose this page at once. The rules aside, with the way in: La puerta. AuthContext.updateUserRole and
// the rules protect the super admin anyway.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { initials } from "../../../lib/vestuario";
import type { PersonRow } from "../../vestuario/live";
import { LoadError } from "../club/ClubStates";
import { useClubWrites } from "../club/useClubWrites";
import { useAdmin } from "../shell/context";
import { useFrame } from "../ui/frame";
import { AdIcon } from "../ui/icons";
import { ConfirmModal } from "../ui/layers";
import { useToast } from "../ui/toastContext";

/** The super admin's account (AuthContext.updateUserRole refuses to touch it). */
export const SUPERADMIN_EMAIL = "adriantomascv@gmail.com";
type Role = "super" | "admin" | "user";
const roleOf = (p: Pick<PersonRow, "role" | "email">): Role => (p.role === "superadmin" || p.email === SUPERADMIN_EMAIL ? "super" : p.role === "admin" ? "admin" : "user");
const RANK: Record<Role, number> = { super: 0, admin: 1, user: 2 };
const ROLE_TEXT: Record<Role, string> = { super: "Capitán general · super admin", admin: "Capitán · administrador", user: "Socio" };

type Member = PersonRow & { r: Role };

export function Capitanes() {
  const data = useAdmin();
  const { desktop } = useFrame();
  const toast = useToast();
  const writes = useClubWrites();
  const { user } = useAuth();
  const [pending, setPending] = useState<Record<string, "admin" | "user">>({});
  const [ask, setAsk] = useState<{ uid: string; to: "admin" | "user" } | null>(null);

  const members: Member[] = useMemo(
    () =>
      data.people
        .filter((p) => !p.removed)
        .map((p) => ({ ...p, r: pending[p.uid] && roleOf(p) !== "super" ? pending[p.uid] : roleOf(p) }))
        .sort((a, b) => RANK[a.r] - RANK[b.r] || (a.nickname || a.email).localeCompare(b.nickname || b.email, "es")),
    [data.people, pending],
  );
  const caps = members.filter((m) => m.r !== "user");
  const socios = members.filter((m) => m.r === "user");
  const handle = (m: { nickname: string; email: string }) => (m.nickname ? `@${m.nickname}` : m.email);

  const target = ask ? members.find((m) => m.uid === ask.uid) : undefined;
  const self = !!target && target.uid === user?.uid;
  const promote = ask?.to === "admin";
  const consequences = promote
    ? ["Podrá publicar actas y convocar", "Podrá aprobar fichas y cambiar el contenido", "Se le puede quitar cuando queráis"]
    : [...(self ? ["Eres tú: dejarás de ver esta página en cuanto se guarde"] : []), "Deja de ver la sala de control", "Sigue siendo socio: su carta y su voto no cambian"];

  const confirm = () => {
    if (!ask || !target) return;
    const { uid, to } = ask;
    const who = handle(target);
    setAsk(null);
    setPending((p) => ({ ...p, [uid]: to }));
    const done = () =>
      setPending((p) => {
        const n = { ...p };
        delete n[uid];
        return n;
      });
    toast.defer({
      tag: "C",
      message: to === "admin" ? `${who} ya lleva el brazalete` : `${who} deja el brazalete · sigue como socio`,
      commit: () => writes.setRole(uid, target.email, to),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: "No se ha podido cambiar el brazalete",
    });
  };

  const member = (m: Member) => {
    const name = handle(m);
    const me = m.uid === user?.uid;
    const last = m.r === "admin" && caps.length <= 1;
    return (
      <div key={m.uid} className="mem" role="listitem" aria-label={`${name}${me ? " (tú)" : ""} · ${ROLE_TEXT[m.r]}`}>
        <span className="pic" aria-hidden="true">
          {initials(m.nickname || m.email)}
          {m.r !== "user" && <span className={m.r === "super" ? "arm gd" : "arm"}>C</span>}
        </span>
        <span className="w">
          <b>
            {name}
            {me ? " · tú" : ""}
          </b>
          <small>
            {ROLE_TEXT[m.r]} · {m.email}
          </small>
        </span>
        <span className="ac">
          {m.r === "super" ? (
            <span className="prot">
              <AdIcon name="lock" size={14} />
              Protegido
            </span>
          ) : last ? (
            <span className="prot">
              <AdIcon name="lock" size={14} />
              Último capitán
            </span>
          ) : m.r === "admin" ? (
            <button type="button" className="btn sm line" onClick={() => setAsk({ uid: m.uid, to: "user" })} aria-haspopup="dialog" aria-label={`Quitar el brazalete a ${name}`}>
              Quitar el brazalete
            </button>
          ) : (
            <button type="button" className="btn sm line" onClick={() => setAsk({ uid: m.uid, to: "admin" })} aria-haspopup="dialog" aria-label={`Dar el brazalete a ${name}`}>
              Dar el brazalete
            </button>
          )}
        </span>
      </div>
    );
  };

  const rules = (
    <aside className="rules" aria-labelledby="cap-rules">
      <h3 id="cap-rules">Las normas del brazalete</h3>
      <ul>
        <li>El capitán general está protegido: nadie le quita el brazalete.</li>
        <li>Nunca os quedáis sin capitanes: el último no puede quitárselo.</li>
        <li>Dar o quitar el brazalete pide confirmación y se puede deshacer.</li>
      </ul>
      <p className="hint">Para ser socio, primero se entra por La puerta.</p>
      <Link className="btn sm line" to="/vestuario" hash="puerta" style={{ alignSelf: "flex-start" }}>
        La puerta
        <AdIcon name="ext" size={14} />
      </Link>
    </aside>
  );

  const body = data.error ? (
    <LoadError what="los socios" />
  ) : data.loading ? (
    <div className="skel" role="status" aria-label="Cargando los capitanes">
      <i />
      <i />
      <i />
    </div>
  ) : (
    <div className="cpg">
      <div className="lk2 scr">
        <p className="gh" id="cap-a">
          Con brazalete <em>{caps.length}</em>
        </p>
        <div className="capA" role="list" aria-labelledby="cap-a">
          {caps.map(member)}
        </div>
        <p className="gh" id="cap-u">
          Socios <em>{socios.length}</em>
        </p>
        {socios.length ? (
          <div role="list" aria-labelledby="cap-u" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {socios.map(member)}
          </div>
        ) : (
          <p className="hint">Todos los socios llevan el brazalete. Los nuevos entran por La puerta.</p>
        )}
      </div>
      {rules}
    </div>
  );

  return (
    <>
      {desktop ? (
        <>
          <div className="vh">
            <div>
              <h1 className="ttl">Capitanes</h1>
              <p className="ld">Quien lleva el brazalete publica actas, convoca y aprueba fichas</p>
            </div>
          </div>
          {body}
        </>
      ) : (
        <div className="msc">{body}</div>
      )}
      <ConfirmModal
        open={!!ask && !!target}
        onClose={() => setAsk(null)}
        title={target ? (promote ? `¿Dar el brazalete a ${handle(target)}?` : `¿Quitar el brazalete a ${handle(target)}?`) : ""}
        consequences={consequences}
        confirmLabel={promote ? "Dar el brazalete" : "Quitar el brazalete"}
        confirmTone={promote ? "sky" : "redf"}
        onConfirm={confirm}
      />
    </>
  );
}
