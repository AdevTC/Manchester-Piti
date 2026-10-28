// CLUB · the rooms of the office: their names, icons, how each saves (A-CLUB-06), their addresses and ⌘K while in the Club.
import { useMemo } from "react";
import type { VIconName } from "../../../../components/vidrio/VIcon";
import { useRegisterCommands } from "../../palette/registry";
import type { PaletteCommand } from "../../palette/search";
import { useSalaGo } from "../../shell/salaHref";

export type RoomId = "temporadas" | "clasificacion" | "web" | "turnos" | "vestuario" | "avisos" | "equipaciones";

export interface RoomDef {
  id: RoomId;
  name: string;
  icon: VIconName;
  save: string;
}

export const ROOMS: readonly RoomDef[] = [
  { id: "temporadas", name: "Temporadas", icon: "trophy", save: "Se guarda al momento, con «Deshacer» 5 s; eliminar pide confirmación y no se deshace." },
  { id: "clasificacion", name: "Clasificación", icon: "chart", save: "Se guarda con «Guardar la clasificación». Si sales con cambios, se pregunta y el borrador se queda aquí." },
  { id: "web", name: "La web del club", icon: "share", save: "Borrador mientras escribes, guardado en el servidor: lo ve el otro capitán y sigue en cualquier dispositivo. La web no cambia hasta «Publicar contenido»." },
  { id: "turnos", name: "Turnos", icon: "wash", save: "Se guarda con «Guardar los turnos». Si sales con cambios, se pregunta y el borrador se queda aquí." },
  { id: "vestuario", name: "El vestuario", icon: "poll", save: "Cada cambio se guarda al momento, con «Deshacer» 5 s." },
  { id: "avisos", name: "Avisos", icon: "bell", save: "Abrir un aviso lo marca leído en tu bandeja; un aviso a mano sale al momento." },
  { id: "equipaciones", name: "Equipaciones", icon: "shirt", save: "Se guarda con «Guardar» y la web lo enseña al momento; sin nada guardado, la web enseña las de siempre." },
];

export const roomOf = (id: RoomId): RoomDef => ROOMS.find((r) => r.id === id) ?? ROOMS[0];
export const roomPath = (id: RoomId) => `/admin/club/${id}`;
export const OFFICE = "/admin/club";

/** ⌘K while in the Club: each room («Club · Temporadas»…), «Nueva temporada» and «Pegar la clasificación». */
export function useClubCommands(): void {
  const go = useSalaGo();
  const cmds = useMemo<PaletteCommand[]>(
    () => [
      ...ROOMS.map((r) => ({ id: `club:${r.id}`, group: "Acciones" as const, icon: "C", title: `Club · ${r.name}`, description: "La oficina del club", hint: "ir", keywords: `club ${r.id} ${r.name}`, run: () => go(roomPath(r.id)) })),
      { id: "club:nueva-temporada", group: "Acciones" as const, icon: "+", title: "Nueva temporada", description: "Club · Temporadas", hint: "ir", keywords: "temporada nueva crear", run: () => go(roomPath("temporadas")) },
      { id: "club:pegar-tabla", group: "Acciones" as const, icon: "T", title: "Pegar la clasificación", description: "Club · Clasificación", hint: "ir", keywords: "tabla liga clasificacion pegar", run: () => go(roomPath("clasificacion")) },
    ],
    [go],
  );
  useRegisterCommands(cmds);
}
