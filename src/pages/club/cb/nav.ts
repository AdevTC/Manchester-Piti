// «El club»'s addresses and its one way of moving between them (the CL- boards' nav/swap): the hub (/club, with a
// piece in focus at /club/vitrina/<pieza>), the rooms (/club/historia, /club/equipo, /club/equipo/camiseta,
// /club/gente) and the fourth one, /vestuario with its blocks (/vestuario/<bloque>). A move is a router navigation
// inside a View Transition: html[data-cb-vt] says which way (in: deeper · out: back to the hub), the page under it
// stays still and the new one comes in on top, while the touched door (named cb-room-<sala>) grows into the room's
// head; back at the hub the door of the room left behind takes the name, so the head shrinks into it. With reduced
// motion, or without View Transitions, the screen just changes.
import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { isShot, prefersReducedMotion } from "../../../components/vidrio/env";
import { PIECE_IDS, type PieceId } from "./model";

export type Sala = "hub" | "historia" | "equipo" | "camiseta" | "gente" | "vestuario";
export const ROOMS = ["historia", "equipo", "gente", "vestuario"] as const;
export type Room = (typeof ROOMS)[number];
export const ROOM_T: Record<Room, string> = { historia: "La historia", equipo: "El equipo", gente: "La gente", vestuario: "El vestuario" };
export const SALA_PATH: Record<Sala, string> = { hub: "/club", historia: "/club/historia", equipo: "/club/equipo", camiseta: "/club/equipo/camiseta", gente: "/club/gente", vestuario: "/vestuario" };

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
/** The club's screen at an address, and the piece it names (/club/vitrina/<pieza>). */
export function clubScreenOf(pathname: string): { sala: Sala; pieza: PieceId | null } {
  const p = trim(pathname);
  if (p === "/club/historia") return { sala: "historia", pieza: null };
  if (p === "/club/equipo") return { sala: "equipo", pieza: null };
  if (p === "/club/equipo/camiseta") return { sala: "camiseta", pieza: null };
  if (p === "/club/gente") return { sala: "gente", pieza: null };
  if (p.startsWith("/vestuario")) return { sala: "vestuario", pieza: null };
  const m = /^\/club\/vitrina\/([^/]+)$/.exec(p);
  const id = m ? decodeURIComponent(m[1]) : null;
  return { sala: "hub", pieza: id && (PIECE_IDS as readonly string[]).includes(id) ? (id as PieceId) : null };
}

/** The room the hub was left for (its door carries the head's name on the way back). Module state: one page. */
let lastRoom: Room | null = null;
export const roomLeft = (): Room | null => lastRoom;

type Doc = Document & { startViewTransition?: (cb: () => Promise<void>) => { ready: Promise<void>; finished: Promise<void> } };

/** Moves to `href` inside the club's View Transition. `into` is "out" back to the hub, "in" anywhere deeper. */
export function useClubNav() {
  const router = useRouter();
  return useCallback(
    (href: string, o: { out?: boolean; from?: Room | null; replace?: boolean } = {}) => {
      if (o.from !== undefined) lastRoom = o.from;
      const root = document.documentElement;
      const doc = document as Doc;
      const go = () => router.navigate({ href, replace: o.replace });
      if (typeof doc.startViewTransition !== "function" || prefersReducedMotion() || isShot()) {
        void go();
        return;
      }
      root.setAttribute("data-cb-vt", o.out ? "out" : "in");
      const clear = () => root.removeAttribute("data-cb-vt");
      // (a page that paints no frame — a background window — never captures the old state: past 400 ms the
      // screen changes without the transition rather than waiting)
      let went = false;
      const late = setTimeout(() => {
        went = true;
        void go();
      }, 400);
      try {
        const vt = doc.startViewTransition(async () => {
          clearTimeout(late);
          if (went) return;
          went = true;
          await go();
          await new Promise((r) => setTimeout(r, 0));
        });
        vt.ready.catch(() => undefined);
        vt.finished.catch(() => undefined).finally(clear);
      } catch {
        clearTimeout(late);
        clear();
        if (!went) void go();
      }
    },
    [router],
  );
}
