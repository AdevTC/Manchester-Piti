// Capitanes — TEMPORARY (P0): the old admins section of Admin until P1b's member list and role modals.
import { Admin } from "../../Admin";
import { AdminView } from "../shell/AdminView";
import { LegacyNote } from "./LegacyNote";

export function Capitanes() {
  return (
    <AdminView kicker="Club" title="Capitanes" lead="Quién puede entrar en la administración. El super admin está protegido.">
      <div className="vb scr ad-legacy">
        <LegacyNote>La tabla de permisos de siempre, mientras llega la nueva.</LegacyNote>
        <Admin section="admins" />
      </div>
    </AdminView>
  );
}
