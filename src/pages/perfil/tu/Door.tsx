// /perfil without a session (TU boards tu-door): what Mi página holds and how to get in — «Entrar con Google», or
// «Pedir entrar al vestuario» (the vestuario's door) — and the goals on this phone without an account. Never a
// redirect: the link works as soon as he is in. Signed in but not let in yet: asking is the way.
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../../../context/AuthContext";
import { TuIcon } from "../../../components/vidrio/tu/ui";

export function Door({ signedIn, onAvisos }: { signedIn: boolean; onAvisos: () => void }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const ask = () => void navigate({ to: "/vestuario" });
  return (
    <main className="tu-main tu-door" id="tu-main">
      <section className="tu-door__in vd-reg-2" aria-labelledby="tu-door-t">
        <div className="tu-door__copy">
          <p className="tu-kick">Mi página</p>
          <h1 className="tu-h1" id="tu-door-t">
            Tu sitio en el Piti empieza en el vestuario
          </h1>
          <p className="tu-lede">Con tu cuenta tienes aquí tu carta con tu camiseta de verdad, tus minutos, tus avisos y tu porra. La afición sigue viéndolo todo sin entrar.</p>
          <div className="tu-row">
            {signedIn ? (
              <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={ask}>
                <TuIcon name="door" />
                Pedir entrar al vestuario
              </button>
            ) : (
              <>
                <button type="button" className="vd-glass vd-press vd-btn vd-btn--pri" onClick={() => void loginWithGoogle()}>
                  <TuIcon name="google" />
                  Entrar con Google
                </button>
                <button type="button" className="vd-link" onClick={ask}>
                  Pedir entrar al vestuario
                </button>
              </>
            )}
          </div>
          <p className="tu-small">
            ¿Solo quieres los goles en el móvil?{" "}
            <button type="button" className="vd-link" onClick={onAvisos}>
              Elige tus avisos sin cuenta
            </button>
          </p>
        </div>
        <ul className="tu-door__list">
          <li>
            <TuIcon name="cardi" />
            <span>
              <b>Tu carta</b> Tu dorsal, tu nombre a la espalda y cómo mejora.
            </span>
          </li>
          <li>
            <TuIcon name="bell" />
            <span>
              <b>Tus avisos</b> La convocatoria y el MVP se responden desde el propio aviso.
            </span>
          </li>
          <li>
            <TuIcon name="star" />
            <span>
              <b>La porra y el MVP</b> Antes del pitido y hasta que se cierra la votación.
            </span>
          </li>
        </ul>
      </section>
    </main>
  );
}
