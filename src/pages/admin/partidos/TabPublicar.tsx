// The «Publicar» tab: «Antes de publicar» — the crónica (+ «Preparar resumen con los datos del acta»), the
// match photo and the gallery with a live HTTPS check, «Minutos y participación» (computed, as the
// backend will) and the MVP line (status only: it opens at publish, closes 48 h later, has a winner).
import { useId, useState } from "react";
import { FieldCheck, Chip } from "../ui/controls";
import { AdIcon } from "../ui/icons";
import { minutesTable } from "../acta/minutes";
import { buildResumen } from "../acta/resumen";
import { okHttps, type MatchSheet } from "../acta/sheetModel";

export function TabPublicar({
  sheet,
  update,
  nameOf,
  status,
  mvp,
  onPoster,
}: {
  sheet: MatchSheet;
  update: (f: (s: MatchSheet) => MatchSheet) => void;
  nameOf: (id: string) => string;
  /** The footer's state («Cuadra · lista para publicar»…) and its tone. */
  status: { text: string; tone: "ok" | "warn" | "" };
  mvp: string;
  onPoster: () => void;
}) {
  const id = useId();
  const [newUrl, setNewUrl] = useState("");
  const photo = sheet.photoUrl ?? "";
  const photoOk = okHttps(photo);
  const gallery = sheet.gallery ?? [];
  const newOk = !!newUrl.trim() && okHttps(newUrl);
  const table = minutesTable(sheet, nameOf);
  const addPhoto = () => {
    if (!newOk || gallery.length >= 20) return;
    update((s) => ({ ...s, gallery: [...(s.gallery ?? []), newUrl.trim()] }));
    setNewUrl("");
  };
  return (
    <div className="pnl">
      <div className="bh">
        <h3 className="h3">Antes de publicar</h3>
        <Chip tone={status.tone}>{status.text}</Chip>
      </div>
      <label className="fld">
        <span className="lbl">Crónica</span>
        <textarea className="inp ad-cron" value={sheet.report} maxLength={10000} onChange={(e) => update((s) => ({ ...s, report: e.target.value }))} placeholder="Cuenta el partido en dos líneas…" />
      </label>
      <div className="row">
        <button type="button" className="btn sm" onClick={() => update((s) => ({ ...s, report: buildResumen(s, nameOf) }))}>
          <AdIcon name="spark" size={16} />
          Preparar resumen con los datos del acta
        </button>
        <button type="button" className="btn sm line" onClick={onPoster}>
          <AdIcon name="image" size={16} />
          Descargar cartel
        </button>
      </div>
      <div className="fld">
        <label className="lbl" htmlFor={`${id}-fo`}>
          Foto del partido (URL HTTPS)
        </label>
        <input id={`${id}-fo`} className={`inp ${photo ? (photoOk ? "good" : "bad") : ""}`.trim()} type="url" value={photo} placeholder="https://" onChange={(e) => update((s) => ({ ...s, photoUrl: e.target.value }))} aria-describedby={`${id}-ph`} aria-invalid={!photoOk || undefined} />
        <FieldCheck id={`${id}-ph`} tone={!photo ? "mut" : photoOk ? "ok" : "bad"}>
          {!photo ? "Opcional · un enlace que empiece por https://" : photoOk ? "Enlace seguro: la foto saldrá en la ficha del partido" : "Tiene que empezar por https:// o no se verá en la web"}
        </FieldCheck>
      </div>
      <div>
        <div className="bh">
          <h3 className="h3">Galería</h3>
          <span className="chip">{gallery.length} de 20</span>
        </div>
        {gallery.length > 0 && (
          <ul className="evl">
            {gallery.map((u, i) => {
              const ok = okHttps(u) && !!u.trim();
              return (
                <li key={`${i}-${u}`} className="evr ad-gal">
                  <span className="mn2">
                    <AdIcon name="image" size={18} />
                  </span>
                  <span className="w">
                    <b className="mono ad-url">{u}</b>
                    <small className={`chk ${ok ? "ok" : "bad"}`}>
                      <AdIcon name={ok ? "check" : "x"} size={12} />
                      {ok ? "HTTPS · se ve en la web" : "No es HTTPS · no se verá en la web"}
                    </small>
                  </span>
                  <button type="button" className="ib" onClick={() => update((s) => ({ ...s, gallery: (s.gallery ?? []).filter((_, k) => k !== i) }))} aria-label={`Quitar ${u}`}>
                    <AdIcon name="trash" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="fld ad-galnew">
          <label className="lbl" htmlFor={`${id}-ga`}>
            Añadir foto (URL HTTPS)
          </label>
          <input
            id={`${id}-ga`}
            className={`inp ${newUrl ? (newOk ? "good" : "bad") : ""}`.trim()}
            type="url"
            value={newUrl}
            placeholder="https://"
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addPhoto();
              }
            }}
            aria-describedby={`${id}-gn`}
          />
          <FieldCheck id={`${id}-gn`} tone={!newUrl ? "mut" : newOk ? "ok" : "bad"}>
            {!newUrl ? "Una foto por enlace, hasta 20" : newOk ? "Enlace seguro" : "Tiene que empezar por https://"}
          </FieldCheck>
        </div>
        <div className="row">
          <button type="button" className="btn sm" onClick={addPhoto} aria-disabled={!newOk || gallery.length >= 20}>
            <AdIcon name="plus" size={16} />
            Añadir a la galería
          </button>
        </div>
      </div>
      <div>
        <div className="bh">
          <h3 className="h3">Minutos y participación</h3>
          {table.errors.length ? <Chip tone="warn">revisa los eventos</Chip> : <Chip tone="ok">calculado</Chip>}
        </div>
        {table.rows.length ? (
          <ul className="evl" aria-label="Minutos y participación">
            {table.rows.map((r) => (
              <li key={r.id} className="evr">
                <span className="mn2">{r.minutes}′</span>
                <span className="w">
                  <b>{r.name}</b>
                  <small>{r.detail}</small>
                </span>
                <span />
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">Salen de la convocatoria y los cambios: haz primero la convocatoria.</p>
        )}
        {table.errors.length > 0 && <p className="hint">{table.errors[0]}</p>}
      </div>
      <p className="mvp">
        <AdIcon name="star" size={18} />
        <span>
          <b>MVP:</b> {mvp}
        </span>
      </p>
    </div>
  );
}
