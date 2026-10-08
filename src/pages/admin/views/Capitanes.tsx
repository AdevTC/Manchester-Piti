// Capitanes — who can enter this administration. Filter Todos / Administradores / Usuarios; each member
// with avatar, nickname, role (Super admin 🔒 / Administrador / Usuario) and e-mail (long ones wrap).
// «Hacer administrador» / «Quitar admin» ask first (what changes) and wait behind an undo toast; the
// super admin is protected (AuthContext.updateUserRole and the rules refuse it anyway). Demoting yourself
// is allowed, as before, but the modal says you lose this page at once.
import { useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { initials } from "../../../lib/vestuario";
import type { PersonRow } from "../../vestuario/live";
import { LoadError } from "../club/ClubStates";
import { useClubWrites } from "../club/useClubWrites";
import { AdminView } from "../shell/AdminView";
import { useAdmin } from "../shell/context";
import { Chip, EmptyState, Segmented, SkeletonRows } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { ConfirmModal, type Consequence } from "../ui/layers";
import { useToast } from "../ui/toastContext";
import "../../../styles/admin-club.css";

/** The super admin's account (AuthContext.updateUserRole refuses to touch it). */
export const SUPERADMIN_EMAIL = "adriantomascv@gmail.com";
type Role = "super" | "admin" | "user";
type Filter = "todos" | "admins" | "usuarios";
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const roleOf = (p: Pick<PersonRow, "role" | "email">): Role => (p.role === "superadmin" || p.email === SUPERADMIN_EMAIL ? "super" : p.role === "admin" ? "admin" : "user");
const RANK: Record<Role, number> = { super: 0, admin: 1, user: 2 };

export function Capitanes() {
  const data = useAdmin();
  const toast = useToast();
  const writes = useClubWrites();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("todos");
  const [pending, setPending] = useState<Record<string, "admin" | "user">>({});
  const [ask, setAsk] = useState<{ uid: string; to: "admin" | "user" } | null>(null);

  const members = useMemo(
    () =>
      data.people
        .filter((p) => !p.removed)
        .map((p) => ({ ...p, r: pending[p.uid] && roleOf(p) !== "super" ? pending[p.uid] : roleOf(p) }))
        .sort((a, b) => RANK[a.r] - RANK[b.r] || (a.nickname || a.email).localeCompare(b.nickname || b.email, "es")),
    [data.people, pending],
  );
  const nA = members.filter((m) => m.r !== "user").length;
  const nU = members.length - nA;
  const shown = members.filter((m) => filter === "todos" || (filter === "admins" ? m.r !== "user" : m.r === "user"));
  const summary = `${plural(nA, "administrador", "administradores")} · ${plural(nU, "usuario", "usuarios")}`;

  const target = ask ? members.find((m) => m.uid === ask.uid) : undefined;
  const nick = (m: { nickname: string; email: string }) => m.nickname || m.email;
  const self = !!target && target.uid === user?.uid;
  const promote = ask?.to === "admin";
  const consequences: Consequence[] = promote
    ? [
        { tone: "g", text: "Podrá editar actas, plantilla, temporadas y contenido" },
        { tone: "g", text: "Podrá abrir la puerta del vestuario e invitar" },
        { tone: "", text: "No podrá quitar al super admin" },
      ]
    : [
        ...(self ? [{ tone: "r" as const, text: "Eres tú: dejarás de ver esta página en cuanto se guarde" }] : []),
        { tone: "r", text: "Deja de ver la administración y la puerta" },
        { tone: "o", text: "Sigue siendo socio: su cuenta y su ficha no cambian" },
        { tone: "", text: "Se le puede volver a hacer administrador" },
      ];

  const confirm = () => {
    if (!ask || !target) return;
    const { uid, to } = ask;
    const who = nick(target);
    setAsk(null);
    setPending((p) => ({ ...p, [uid]: to }));
    const done = () =>
      setPending((p) => {
        const n = { ...p };
        delete n[uid];
        return n;
      });
    toast.defer({
      message: to === "admin" ? `${who} ya es administrador.` : `${who} ya no es administrador.`,
      commit: () => writes.setRole(uid, target.email, to),
      onUndo: done,
      onError: done,
      onDone: done,
      errorMessage: "No se ha podido cambiar el rol",
    });
  };

  return (
    <AdminView
      kicker="Club"
      title="Capitanes"
      lead="Quién puede entrar en la administración. El super admin está protegido."
      chips={
        <li>
          <Chip tone="sky" icon="shield">
            {summary}
          </Chip>
        </li>
      }
    >
      {data.error ? (
        <LoadError what="los miembros" />
      ) : (
        <div className="vb cd tbl">
          <div className="tools">
            <Segmented<Filter>
              label="Filtrar miembros"
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todos", label: "Todos", count: members.length },
                { value: "admins", label: "Administradores", count: nA },
                { value: "usuarios", label: "Usuarios", count: nU },
              ]}
            />
          </div>
          <div className="scr">
            {data.loading ? (
              <div className="rows">
                <SkeletonRows rows={5} label="Cargando los miembros…" />
              </div>
            ) : shown.length ? (
              <ul className="rows" aria-label="Miembros">
                {shown.map((m) => {
                  const name = nick(m);
                  const me = m.uid === user?.uid;
                  return (
                    <li key={m.uid} className="mbr">
                      <span className="av" aria-hidden="true">
                        {initials(m.nickname || m.email)}
                      </span>
                      <span className="w">
                        <b>
                          {name}
                          {me && <span className="ad-you">(tú)</span>}
                          {m.r === "super" ? (
                            <Chip tone="gold" icon="lock">
                              Super admin
                            </Chip>
                          ) : m.r === "admin" ? (
                            <Chip tone="sky" icon="shield">
                              Administrador
                            </Chip>
                          ) : (
                            <Chip icon={null}>Usuario</Chip>
                          )}
                        </b>
                        <span className="em">{m.email}</span>
                      </span>
                      <span className="a">
                        {m.r === "super" ? (
                          <Chip icon="lock">Protegido</Chip>
                        ) : m.r === "admin" ? (
                          <button type="button" className="btn sm red" onClick={() => setAsk({ uid: m.uid, to: "user" })} aria-haspopup="dialog" aria-label={`Quitar admin a ${name}`}>
                            Quitar admin
                          </button>
                        ) : (
                          <button type="button" className="btn sm line" onClick={() => setAsk({ uid: m.uid, to: "admin" })} aria-haspopup="dialog" aria-label={`Hacer administrador a ${name}`}>
                            <AdIcon name="shield" size={16} />
                            Hacer administrador
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="team" className="ad-m12" title={filter === "admins" ? "Ningún administrador" : filter === "usuarios" ? "Ningún usuario sin cargo" : "Todavía no hay miembros"}>
                Los socios entran por la puerta del vestuario.
              </EmptyState>
            )}
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!ask && !!target}
        onClose={() => setAsk(null)}
        role="alertdialog"
        tone={promote ? "" : "red"}
        kicker="Capitanes"
        title={target ? (promote ? `¿Hacer administrador a ${nick(target)}?` : `¿Quitar el admin a ${nick(target)}?`) : ""}
        lede={promote ? "Podrá entrar en esta administración." : self ? "Dejarás de poder entrar en esta administración." : "Dejará de poder entrar en esta administración."}
        consequences={consequences}
        confirmLabel={promote ? "Hacer administrador" : "Quitar admin"}
        confirmTone={promote ? "pri" : "red solid"}
        onConfirm={confirm}
      />
    </AdminView>
  );
}
