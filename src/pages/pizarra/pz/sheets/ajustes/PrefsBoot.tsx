// r14 «La pizarra» · Ajustes at work from the first moment (the shell mounts this once; it draws nothing):
//  · plates, galones and motion on every pitch (prefsLive.applyPrefsCss);
//  · the sounds: a clac when the seven changes, the grada when it is complete or published (only with «Sonidos»);
//  · a camera or a layer changed in Ajustes — here or on another device — reaches the pitch on screen at once
//    (entering a place already honours them: store.stageDefaults and the boot layer).
import { useEffect, useRef } from "react";
import { usePz } from "../../store/context";
import type { Camera, LayerId } from "../../store/types";
import { LAYERS } from "../../store/store";
import { applyPrefsCss, placeCamera, prefsNow, removePrefsCss, sonar } from "./prefsLive";

const WITH_PITCH: readonly string[] = ["siete", "plan", "jugadas", "partido", "pachanga"];

export function PrefsBoot() {
  const P = usePz();
  const pf = prefsNow(P);
  const css = `${pf.nombre}|${pf.galones}|${pf.mov}`;
  useEffect(() => {
    applyPrefsCss(prefsNow(P));
    // (P is a new facade per version: the CSS only depends on the three settings)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [css]);
  useEffect(() => () => removePrefsCss(), []);

  // the sounds (the store's events; one subscription for the page's store)
  const store = useRef(P);
  useEffect(() => {
    store.current = P;
  });
  useEffect(() => {
    const p = store.current;
    const offs = [p.on("siete", () => sonar(store.current, "clac")), p.on("siete:listo", () => sonar(store.current, "grada")), p.on("publish", () => sonar(store.current, "grada"))];
    return () => offs.forEach((off) => off());
  }, []);

  // a camera or a default layer changed (Ajustes here, or another device): the pitch on screen follows
  const prev = useRef({ camara: pf.camara, capa: pf.capa });
  useEffect(() => {
    const was = prev.current;
    prev.current = { camara: pf.camara, capa: pf.capa };
    const p = store.current;
    const place = p.state.route.place;
    if (was.camara !== pf.camara && WITH_PITCH.includes(place)) {
      const cam: Camera = pf.camara === "sitio" ? placeCamera(p, place) : (pf.camara as Camera);
      if (p.state.stage.camera !== cam) p.act.setStage({ camera: cam });
    }
    if (was.capa !== pf.capa && p.state.layer === was.capa && LAYERS.some((l) => l.id === pf.capa)) p.act.setLayer(pf.capa as LayerId);
  }, [pf.camara, pf.capa]);
  return null;
}
