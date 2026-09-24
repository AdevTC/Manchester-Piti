import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useClubContent, type ClubContent } from "../../lib/clubContent";
import { useClubData, playerName } from "../../lib/clubData";
import { apiError } from "../../lib/clubApi";
import { Save, Plus, Trash2 } from "lucide-react";
export function ContentEditor() {
  const content = useClubContent();
  const { players } = useClubData();
  const [draft, setDraft] = useState<ClubContent | null>(null);
  const value = draft ?? content;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [bio, setBio] = useState("");
  const [quote, setQuote] = useState("");
  const [photo, setPhoto] = useState("");
  const update = <K extends keyof ClubContent>(key: K, next: ClubContent[K]) =>
    setDraft({ ...value, [key]: next });
  const validUrl = (v: string) =>
    !v || (/^https:\/\//.test(v) && !!new URL(v).hostname);
  const save = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const urls = [
        value.photoUrl,
        value.instagram,
        ...value.gallery.map((p) => p.url),
        ...value.sponsors.flatMap((p) => [p.url, p.logo]),
      ];
      if (urls.some((u) => !validUrl(u)))
        throw new Error(
          "Las imágenes y enlaces deben usar direcciones HTTPS completas.",
        );
      if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
        throw new Error("Revisa el correo de contacto.");
      if (
        value.milestones.some((m) => !m.title.trim()) ||
        value.sponsors.some((s) => !s.name.trim())
      )
        throw new Error("Completa los nombres de los hitos y colaboradores.");
      await setDoc(doc(db, "clubContent", "main"), value);
      setDraft(null);
      setMessage("Contenido del club actualizado.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  const savePlayer = async () => {
    setBusy(true);
    setError("");
    try {
      if (!validUrl(photo)) throw new Error("Usa una URL HTTPS para la foto.");
      await setDoc(
        doc(db, "players", playerId),
        { bio, quote, photoUrl: photo },
        { merge: true },
      );
      setMessage("Perfil deportivo actualizado.");
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="club-page club-editor">
      <Link to="/admin" className="club-text-link">
        ← Volver a administración
      </Link>
      <header className="club-page-head">
        <span className="club-kicker">LA VOZ DEL EQUIPO</span>
        <h1>
          Hazlo
          <br />
          <em>vuestro.</em>
        </h1>
        <p>
          Texto, fotos e historia. Los espacios sin imagen conservan una
          ilustración del club.
        </p>
      </header>
      <section className="club-panel">
        <h2>El club</h2>
        <div className="club-form-grid">
          {(
            [
              ["intro", "Frase de presentación"],
              ["location", "Localidad"],
              ["founded", "Año de fundación"],
              ["venue", "Campo y dirección"],
              ["email", "Correo de contacto"],
              ["instagram", "Enlace de Instagram"],
              ["photoUrl", "Foto de equipo (URL HTTPS)"],
            ] as const
          ).map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                value={value[k]}
                onChange={(e) => update(k, e.target.value)}
              />
            </label>
          ))}
        </div>
        <label className="club-field">
          Nuestra historia
          <textarea
            rows={7}
            value={value.story}
            onChange={(e) => update("story", e.target.value)}
          />
        </label>
      </section>
      <section className="club-panel">
        <h2>Momentos del club</h2>
        {value.milestones.map((m, i) => (
          <div key={i} className="club-content-row">
            <label>
              Año
              <input
                value={m.year}
                onChange={(e) =>
                  update(
                    "milestones",
                    value.milestones.map((x, j) =>
                      j === i ? { ...x, year: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Título
              <input
                value={m.title}
                onChange={(e) =>
                  update(
                    "milestones",
                    value.milestones.map((x, j) =>
                      j === i ? { ...x, title: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Recuerdo
              <input
                value={m.text}
                onChange={(e) =>
                  update(
                    "milestones",
                    value.milestones.map((x, j) =>
                      j === i ? { ...x, text: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              aria-label="Quitar momento"
              onClick={() =>
                update(
                  "milestones",
                  value.milestones.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          className="club-button secondary"
          onClick={() =>
            update("milestones", [
              ...value.milestones,
              { year: "", title: "", text: "" },
            ])
          }
        >
          <Plus size={16} />
          Añadir momento
        </button>
      </section>
      <section className="club-panel">
        <h2>Colaboradores</h2>
        {value.sponsors.map((m, i) => (
          <div key={i} className="club-content-row">
            {(["name", "url", "logo"] as const).map((k, j) => (
              <label key={k}>
                {["Nombre", "Web HTTPS", "Logo HTTPS"][j]}
                <input
                  value={m[k]}
                  onChange={(e) =>
                    update(
                      "sponsors",
                      value.sponsors.map((x, n) =>
                        n === i ? { ...x, [k]: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <button
              aria-label="Quitar colaborador"
              onClick={() =>
                update(
                  "sponsors",
                  value.sponsors.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          className="club-button secondary"
          onClick={() =>
            update("sponsors", [
              ...value.sponsors,
              { name: "", url: "", logo: "" },
            ])
          }
        >
          <Plus size={16} />
          Añadir colaborador
        </button>
      </section>
      <section className="club-panel">
        <h2>Galería del equipo</h2>
        {value.gallery.map((m, i) => (
          <div key={i} className="club-content-row">
            <label>
              Foto HTTPS
              <input
                value={m.url}
                onChange={(e) =>
                  update(
                    "gallery",
                    value.gallery.map((x, j) =>
                      j === i ? { ...x, url: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <label>
              Pie de foto
              <input
                value={m.caption}
                onChange={(e) =>
                  update(
                    "gallery",
                    value.gallery.map((x, j) =>
                      j === i ? { ...x, caption: e.target.value } : x,
                    ),
                  )
                }
              />
            </label>
            <button
              aria-label="Quitar foto"
              onClick={() =>
                update(
                  "gallery",
                  value.gallery.filter((_, j) => j !== i),
                )
              }
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
        <button
          className="club-button secondary"
          onClick={() =>
            update("gallery", [...value.gallery, { url: "", caption: "" }])
          }
        >
          <Plus size={16} />
          Añadir foto
        </button>
      </section>
      <button
        className="club-button"
        disabled={busy}
        onClick={() => void save()}
      >
        <Save size={16} />
        {busy ? "Guardando…" : "Publicar contenido del club"}
      </button>
      <section className="club-panel">
        <h2>Historias de jugadores</h2>
        <label className="club-field">
          Jugador
          <select
            value={playerId}
            onChange={(e) => {
              setPlayerId(e.target.value);
              const p = players.find((x) => x.id === e.target.value);
              setBio(p?.bio || "");
              setQuote(p?.quote || "");
              setPhoto(p?.photoUrl || "");
            }}
          >
            <option value="">Selecciona un jugador</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {playerName(p)}
              </option>
            ))}
          </select>
        </label>
        {playerId && (
          <>
            <div className="club-form-grid">
              <label>
                Foto HTTPS
                <input
                  value={photo}
                  onChange={(e) => setPhoto(e.target.value)}
                />
              </label>
              <label>
                Su frase
                <input
                  value={quote}
                  onChange={(e) => setQuote(e.target.value)}
                />
              </label>
            </div>
            <label className="club-field">
              Presentación
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>
            <button
              className="club-button"
              disabled={busy}
              onClick={() => void savePlayer()}
            >
              Guardar perfil
            </button>
          </>
        )}
      </section>
      {error && (
        <p className="club-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="club-success" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
