// Bloque 5 · «Ver en vídeo» in Jugadas: the jugada's video link (YouTube, Drive or any https page) opening
// in a new tab at its minute, and — on an editable board — the little form that links it, changes it or
// takes it off. The board saves it into the jugada (playVideo.ts checks it; setPlayVideo stores it).
import { useId, useState } from "react";
import { Icon } from "./icons";
import { clockTxt, readVideo, videoHref, videoLabel, type PlayVideo } from "./playVideo";
import "../../../styles/pizarra-presenta.css";

export interface JugadaVideoProps {
  video: PlayVideo | null;
  canEdit: boolean;
  /** Keep (or take off, null) the jugada's video; returns whether it was kept. */
  onSave: (v: PlayVideo | null) => boolean;
}

export function JugadaVideo({ video, canEdit, onSave }: JugadaVideoProps) {
  const id = useId();
  const [form, setForm] = useState<{ url: string; at: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const href = video ? videoHref(video) : "";
  const lab = video ? videoLabel(video) : null;
  const open = () => {
    setErr(null);
    setForm({ url: video?.url ?? "", at: video ? clockTxt(video.at) : "0:00" });
  };
  if (!video && !canEdit) return null;
  const save = () => {
    if (!form) return;
    const r = readVideo(form.url, form.at);
    if ("error" in r) {
      setErr(r.error);
      return;
    }
    if (onSave(r.video)) {
      setForm(null);
      setErr(null);
    }
  };
  return (
    <div className="b5p-vid" role="group" aria-label="Vídeo de la jugada">
      {video && href && lab && (
        <a className="b5p-vid-a" href={href} target="_blank" rel="noopener noreferrer" aria-label={lab.aria}>
          <Icon n="film" w={16} />
          <span>{lab.txt}</span>
        </a>
      )}
      {canEdit && !form && (
        <div className="b5p-row">
          <button type="button" className="b3" onClick={open}>
            <Icon n="link" w={15} />
            {video ? "Cambiar el vídeo" : "Enlazar un vídeo"}
          </button>
          {video && (
            <button type="button" className="b3" onClick={() => onSave(null)}>
              <Icon n="x" w={15} />
              Quitar el vídeo
            </button>
          )}
        </div>
      )}
      {canEdit && form && (
        <form
          className="b5p-vid-f"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setForm(null);
              setErr(null);
            }
          }}
        >
          <label className="b5p-fld">
            <span>Enlace del vídeo (https)</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://youtu.be/…"
              value={form.url}
              maxLength={320}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              aria-invalid={!!err}
              aria-describedby={err ? id + "-e" : undefined}
            />
          </label>
          <label className="b5p-fld b5p-fld-s">
            <span>Empieza en (min:seg)</span>
            <input type="text" inputMode="numeric" autoComplete="off" placeholder="12:34" value={form.at} maxLength={8} onChange={(e) => setForm({ ...form, at: e.target.value })} />
          </label>
          {err && (
            <small className="b5p-err" id={id + "-e"} role="alert">
              {err}
            </small>
          )}
          <div className="b5p-row">
            <button type="submit" className="b3 gold">
              <Icon n="check" w={15} />
              Guardar el vídeo
            </button>
            <button
              type="button"
              className="b3"
              onClick={() => {
                setForm(null);
                setErr(null);
              }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
