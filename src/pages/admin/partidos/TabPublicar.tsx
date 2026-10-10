// The «Publicar» tab, as on the canvas (stats-gen/ad-v2-full.mjs `pubT`): the crónica in a light card (its
// headline from the acta, the text editable) + «Preparar resumen con el acta», the match photo with its
// HTTPS check (and the gallery), the minutes computed from the convocatoria and the changes, and the MVP
// status (it opens by itself when the acta is published and closes 48 h later: never by hand). A match
// still to play has nothing to publish yet.
import { useId, useState } from "react";
import { AdIcon } from "../ui/icons";
import { minutesTable } from "../acta/minutes";
import { buildResumen } from "../acta/resumen";
import { okHttps, type MatchSheet } from "../acta/sheetModel";
import { dayOf } from "./listModel";
import { cronicaHeadline, cronicaKicker, type Phase } from "./workspaceModel";

const MAX_GALLERY = 20;

function HttpsCheck({ id, url }: { id: string; url: string }) {
  if (!url) return null;
  return okHttps(url) ? (
    <span id={id} className="okk" style={{ fontSize: 13 }}>
      <AdIcon name="check" size={13} />
      Se ve bien
    </span>
  ) : (
    <span id={id} className="bad" style={{ fontSize: 13 }}>
      <AdIcon name="x" size={13} />
      No es HTTPS
    </span>
  );
}

export function TabPublicar({
  phase,
  sheet,
  update,
  j,
  rival,
  gf,
  ga,
  nameOf,
  mvp,
  onPoster,
}: {
  phase: Phase;
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  j: string;
  rival: string;
  gf: number;
  ga: number;
  nameOf: (id: string) => string;
  mvp: { title: string; detail: string };
  onPoster: () => void;
}) {
  const id = useId();
  const [newUrl, setNewUrl] = useState("");
  if (phase !== "jugado")
    return (
      <div className="void">
        <h3>Aún no hay nada que publicar</h3>
        <p>Cuando se juegue y cuadre el acta, aquí verás la crónica, la foto, los minutos y el MVP.</p>
      </div>
    );
  const photo = sheet.photoUrl ?? "";
  const gallery = sheet.gallery ?? [];
  const newOk = !!newUrl.trim() && okHttps(newUrl.trim());
  const table = minutesTable(sheet, nameOf);
  const addPhoto = () => {
    if (!newOk || gallery.length >= MAX_GALLERY) return;
    update((s) => ({ ...s, gallery: [...(s.gallery ?? []), newUrl.trim()] }));
    setNewUrl("");
  };
  return (
    <div className="pubg">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="cron">
          <span className="k">{cronicaKicker(j, sheet.date, dayOf)}</span>
          <b>{cronicaHeadline(gf, ga, sheet.home, rival)}</b>
          <textarea
            className="crt"
            aria-label="Crónica"
            value={sheet.report}
            maxLength={10000}
            onChange={(e) => update((s) => ({ ...s, report: e.target.value }))}
            placeholder="Cuenta el partido en dos líneas, o pulsa «Preparar resumen con el acta»."
          />
        </div>
        <div className="cta-row">
          <button type="button" className="btn sm line" onClick={() => update((s) => ({ ...s, report: buildResumen(s, nameOf) }))}>
            Preparar resumen con el acta
          </button>
          <span className="hint">Se puede retocar antes de publicar</span>
        </div>
        <div className="fld">
          <label htmlFor={`${id}-ph`}>Foto del partido (HTTPS)</label>
          <input
            id={`${id}-ph`}
            className={`inp${photo && !okHttps(photo) ? " bad" : ""}`}
            type="url"
            value={photo}
            placeholder="https://…"
            onChange={(e) => update((s) => ({ ...s, photoUrl: e.target.value }))}
            aria-invalid={(!!photo && !okHttps(photo)) || undefined}
            aria-describedby={photo ? `${id}-phk` : undefined}
          />
          <HttpsCheck id={`${id}-phk`} url={photo} />
        </div>
        <div className="fld">
          <span className="lb">
            Galería · {gallery.length} de {MAX_GALLERY}
          </span>
          {gallery.length > 0 && (
            <ul className="hl">
              {gallery.map((u, i) => {
                const ok = !!u.trim() && okHttps(u);
                return (
                  <li key={`${i}-${u}`} style={{ gridTemplateColumns: "minmax(0, 1fr) auto auto" }}>
                    <span style={{ overflowWrap: "anywhere", fontSize: 14 }}>{u}</span>
                    {ok ? (
                      <span className="okk" style={{ fontSize: 13 }}>
                        <AdIcon name="check" size={13} />
                        HTTPS
                      </span>
                    ) : (
                      <span className="bad" style={{ fontSize: 13 }}>
                        <AdIcon name="x" size={13} />
                        No es HTTPS
                      </span>
                    )}
                    <button type="button" className="ib2" onClick={() => update((s) => ({ ...s, gallery: (s.gallery ?? []).filter((_, k) => k !== i) }))} aria-label={`Quitar ${u}`}>
                      <AdIcon name="x" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="inp"
              type="url"
              value={newUrl}
              placeholder="https://…"
              aria-label="Añadir foto a la galería (HTTPS)"
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhoto();
                }
              }}
            />
            <button type="button" className="btn sm line" onClick={addPhoto} disabled={!newOk || gallery.length >= MAX_GALLERY}>
              Añadir
            </button>
          </div>
          {newUrl.trim() && !newOk ? (
            <span className="bad" style={{ fontSize: 13 }}>
              <AdIcon name="x" size={13} />
              Tiene que empezar por https://
            </span>
          ) : null}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="mvpc">
          <span className="st">
            <AdIcon name="star" size={22} />
          </span>
          <span>
            <b>{mvp.title}</b>
            <small>{mvp.detail}</small>
          </span>
        </div>
        <div className="calm">
          <h3>
            Minutos <em>de la convocatoria y los cambios</em>
          </h3>
          {table.rows.length ? (
            <div className="mins" role="list" aria-label="Minutos">
              {table.rows.map((r) => (
                <span key={r.id} role="listitem" title={r.detail}>
                  {r.name}
                  <b>{r.minutes}′</b>
                </span>
              ))}
            </div>
          ) : (
            <p className="hint">Salen de la convocatoria: hazla primero en Convocar.</p>
          )}
          {table.errors.length > 0 && (
            <p className="warn" style={{ fontSize: 13 }}>
              <AdIcon name="alert" size={14} />
              {table.errors[0]}
            </p>
          )}
        </div>
        <button type="button" className="btn sm line" onClick={onPoster} style={{ alignSelf: "flex-start" }}>
          <AdIcon name="image" size={16} />
          Descargar el cartel
        </button>
      </div>
    </div>
  );
}
